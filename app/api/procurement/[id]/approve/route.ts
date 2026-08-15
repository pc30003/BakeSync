import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, notFound, serverError, requireAuth } from "@/lib/api-helpers";
import { computeAlertLevel } from "@/lib/stock-actions";

// POST /api/procurement/[id]/approve — one-click approval + auto-restock
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await requireAuth(["PURCHASING_MANAGER", "HEAD_BAKER"]);
  if (response) return response;

  try {
    const existing = await db.procurementRecommendation.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
      include: { ingredient: true },
    });
    if (!existing) return notFound("Procurement recommendation");

    // Approve the recommendation
    const updated = await db.procurementRecommendation.update({
      where: { id: params.id },
      data: {
        approvedAt:   new Date(),
        approvedById: session!.user.id,
      },
      include: {
        ingredient: { select: { id: true, name: true } },
        supplier:   { select: { id: true, name: true } },
      },
    });

    // Auto-restock: add the recommended order quantity to current stock
    if (existing.ingredient) {
      const currentStock = Number(existing.ingredient.stockGrams);
      const orderGrams = Number(existing.recommendedOrderGrams);
      const newStock = currentStock + orderGrams;

      const alertLevel = computeAlertLevel(
        newStock,
        Number(existing.ingredient.criticalThresholdGrams),
        Number(existing.ingredient.reorderThresholdGrams)
      );

      await db.ingredient.update({
        where: { id: existing.ingredientId },
        data:  { stockGrams: newStock, alertLevel },
      });

      // Dismiss any related alerts for this ingredient since stock is restored
      await db.agentAlert.updateMany({
        where: {
          bakeryId:        session!.user.bakeryId,
          relatedEntityId: existing.ingredientId,
          isDismissed:     false,
          type:            { in: ["SHORTFALL", "LOW_STOCK"] },
        },
        data: { isDismissed: true },
      });
    }

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}
