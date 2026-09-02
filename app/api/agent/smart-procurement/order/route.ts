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

    // ── Idempotency guard ────────────────────────────────────────────────
    // Prevent double-restock: if this exact ingredient was already ordered via
    // the AI panel in the last 10 minutes, refuse. Guards against repeat clicks
    // across a "Refresh", multiple tabs, or a double-submit. We match on the
    // action summary (which embeds the ingredient name) so this stays portable
    // and never depends on JSON-path query support.
    const recentOrder = await db.agentAction.findFirst({
      where: {
        bakeryId,
        type:        "PROCUREMENT_RECOMMENDATION",
        completedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        summary:     { contains: `${ingredient.name} — stock restored` },
      },
    });
    if (recentOrder) {
      return error(`${ingredient.name} was already ordered in the last few minutes — stock is restored.`, 409);
    }
    // NOTE: we intentionally do NOT block based on current stock level. The AI
    // panel is for PROACTIVE ordering — restocking before an ingredient runs
    // low — so a healthy stock level is a valid reason to order more. The
    // recent-order guard above is what prevents accidental double-restock.

    const currentStock = Number(ingredient.stockGrams);
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
