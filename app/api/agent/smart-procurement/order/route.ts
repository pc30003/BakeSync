/**
 * POST /api/agent/smart-procurement/order
 *
 * Makes an AI procurement recommendation actionable: given an ingredient NAME
 * (the AI panel has names, not IDs) and a quantity in kg, it restocks that
 * ingredient in real time — reusing the exact same restock math as the manual
 * approval route (/api/procurement/[id]/approve) so behaviour is identical.
 *
 * Safety guards:
 *  - bakery-scoped ingredient resolution (no cross-tenant)
 *  - quantity validated + capped so a hallucinated value can't blow up stock
 *  - stock update + alert/rec cleanup wrapped in a transaction (atomic)
 *  - auto-approves any overlapping PENDING manual recommendation for the same
 *    ingredient, so the same ingredient can't be restocked twice
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, error, notFound, serverError, validationError, requireAuth } from "@/lib/api-helpers";
import { computeAlertLevel } from "@/lib/stock-actions";

const OrderSchema = z.object({
  ingredientName: z.string().min(1),
  quantityKg:     z.number().positive(),
});

// Hard cap so an implausible AI quantity can never corrupt stock levels.
const MAX_ORDER_GRAMS = 100_000; // 100 kg

export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER", "PURCHASING_MANAGER"]);
  if (response) return response;

  try {
    const bakeryId = session!.user.bakeryId;
    const body = await req.json();
    const parsed = OrderSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { ingredientName } = parsed.data;
    const orderGrams = Math.min(Math.round(parsed.data.quantityKg * 1000), MAX_ORDER_GRAMS);
    if (orderGrams <= 0) return error("Order quantity must be greater than zero.", 400);

    // Resolve the ingredient by name within THIS bakery only.
    // Exact (case-insensitive) match first, then a contains fallback.
    const nameLower = ingredientName.trim().toLowerCase();
    const candidates = await db.ingredient.findMany({
      where: { bakeryId, isTracked: true },
    });
    const ingredient =
      candidates.find((i) => i.name.toLowerCase() === nameLower) ??
      candidates.find((i) => i.name.toLowerCase().includes(nameLower)) ??
      candidates.find((i) => nameLower.includes(i.name.toLowerCase()));

    if (!ingredient) return notFound("Ingredient");

    const currentStock = Number(ingredient.stockGrams);

    // ── Idempotency guard (state-based, not just time-based) ──────────────
    // We only want to block ACCIDENTAL duplicates (double-click, refresh-and-
    // reclick, two tabs) — NOT a legitimate reorder after the stock was used
    // up again (e.g. logged wastage or checklist deductions since the last
    // order). So: find the most recent order for this ingredient in the last
    // 10 minutes and read the stock level it left behind. If the current stock
    // is still at/above that level, nothing has been consumed since → it's a
    // duplicate, block it. If stock has dropped below that level, real usage
    // happened → allow the reorder.
    const recentActions = await db.agentAction.findMany({
      where: {
        bakeryId,
        type:        "PROCUREMENT_RECOMMENDATION",
        completedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      orderBy: { completedAt: "desc" },
      take: 20,
    });
    // Match on the stable details.ingredientId (not the summary text), filtered
    // in JS so we don't depend on JSON-path query support. Only THIS route's
    // order actions carry a details.ingredientId; the analysis actions don't.
    const recentOrder = recentActions.find(
      (a) => (a.details as { ingredientId?: string } | null)?.ingredientId === ingredient.id
    );
    if (recentOrder) {
      const lastLeftStock = Number(
        (recentOrder.details as { newStockGrams?: number })?.newStockGrams ?? 0
      );
      // Nothing consumed since the last order → true duplicate, block it.
      if (currentStock >= lastLeftStock) {
        return error(`${ingredient.name} was already ordered in the last few minutes — stock is restored.`, 409);
      }
      // else: stock dropped since (wastage/production) → allow the reorder.
    }

    const newStock     = currentStock + orderGrams;
    const alertLevel   = computeAlertLevel(
      newStock,
      Number(ingredient.criticalThresholdGrams),
      Number(ingredient.reorderThresholdGrams)
    );

    // Atomic: restock + dismiss shortfall alerts + retire overlapping manual recs.
    await db.$transaction(async (tx) => {
      await tx.ingredient.update({
        where: { id: ingredient.id },
        data:  { stockGrams: newStock, alertLevel },
      });

      // Dismiss any open shortfall alerts for this ingredient — stock is restored.
      await tx.agentAlert.updateMany({
        where: {
          bakeryId,
          relatedEntityId: ingredient.id,
          isDismissed:     false,
          type:            "SHORTFALL",
        },
        data: { isDismissed: true },
      });

      // Retire any PENDING manual recommendation for the same ingredient so it
      // can't be approved again (which would double-restock).
      await tx.procurementRecommendation.updateMany({
        where: {
          bakeryId,
          ingredientId: ingredient.id,
          approvedAt:   null,
          dismissedAt:  null,
        },
        data: {
          approvedAt:   new Date(),
          approvedById: session!.user.id,
        },
      });

      // Log the autonomous order as an AgentAction for the activity feed.
      const startedAt = new Date();
      await tx.agentAction.create({
        data: {
          bakeryId,
          type:        "PROCUREMENT_RECOMMENDATION",
          status:      "COMPLETED",
          summary:     `Ordered ${(orderGrams / 1000).toFixed(2)} kg ${ingredient.name} — stock restored`,
          details: {
            ingredientId:   ingredient.id,
            ingredientName: ingredient.name,
            orderedGrams:   orderGrams,
            newStockGrams:  newStock,
            alertLevel,
          },
          triggeredAt: startedAt,
          completedAt: new Date(),
        },
      });
    });

    return ok({
      ingredientId:   ingredient.id,
      ingredientName: ingredient.name,
      orderedGrams:   orderGrams,
      newStockGrams:  newStock,
      alertLevel,
    });
  } catch (err) {
    return serverError(err);
  }
}
