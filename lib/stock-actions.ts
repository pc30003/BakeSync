/**
 * lib/stock-actions.ts
 *
 * Shared logic for stock-related side effects.
 * Called after any stock level change to auto-generate alerts and procurement recommendations.
 */

import { db } from "@/lib/db";

type AlertLevel = "OK" | "LOW" | "CRITICAL" | "OUT_OF_STOCK";

interface StockCheckParams {
  ingredientId: string;
  bakeryId:     string;
  newStock:     number;
  alertLevel:   AlertLevel;
  userId?:      string;
}

/**
 * Computes the correct alert level based on stock vs thresholds.
 */
export function computeAlertLevel(
  stockGrams: number,
  criticalThresholdGrams: number,
  reorderThresholdGrams: number
): AlertLevel {
  if (stockGrams <= 0) return "OUT_OF_STOCK";
  if (stockGrams <= criticalThresholdGrams) return "CRITICAL";
  if (stockGrams <= reorderThresholdGrams) return "LOW";
  return "OK";
}

/**
 * After stock changes, auto-generate alert and procurement recommendation if needed.
 */
export async function handleStockChange({
  ingredientId,
  bakeryId,
  newStock,
  alertLevel,
}: StockCheckParams) {
  const ingredient = await db.ingredient.findUnique({
    where: { id: ingredientId },
    select: {
      name: true,
      reorderThresholdGrams: true,
      criticalThresholdGrams: true,
      costPerKg: true,
      supplierId: true,
    },
  });
  if (!ingredient) return;

  // ── Auto-generate alert when CRITICAL or OUT_OF_STOCK ─────────────────
  if (alertLevel === "CRITICAL" || alertLevel === "OUT_OF_STOCK") {
    // Don't create duplicate alerts for the same ingredient
    const existingAlert = await db.agentAlert.findFirst({
      where: {
        bakeryId,
        relatedEntityId: ingredientId,
        isDismissed: false,
        type: "SHORTFALL",
      },
    });

    if (!existingAlert) {
      const severity = alertLevel === "OUT_OF_STOCK" ? "CRITICAL" : "WARNING";
      const title = alertLevel === "OUT_OF_STOCK"
        ? `Out of stock: ${ingredient.name}`
        : `Critical stock: ${ingredient.name}`;
      const message = alertLevel === "OUT_OF_STOCK"
        ? `${ingredient.name} is completely out of stock. Production may be blocked until restocked.`
        : `${ingredient.name} has dropped to ${(newStock / 1000).toFixed(2)} kg — below the critical threshold of ${(Number(ingredient.criticalThresholdGrams) / 1000).toFixed(2)} kg. Order urgently.`;

      await db.agentAlert.create({
        data: {
          bakeryId,
          type:              "SHORTFALL",
          severity,
          title,
          message,
          relatedEntityId:   ingredientId,
          relatedEntityType: "Ingredient",
        },
      });
    }
  }

  // ── Auto-generate procurement recommendation when below reorder ────────
  if (newStock <= Number(ingredient.reorderThresholdGrams)) {
    const existingRec = await db.procurementRecommendation.findFirst({
      where: {
        ingredientId,
        bakeryId,
        approvedAt:  null,
        dismissedAt: null,
      },
    });

    if (!existingRec) {
      const shortfall = Number(ingredient.reorderThresholdGrams) - newStock;
      const orderGrams = shortfall * 1.5; // 50% buffer
      const urgency = alertLevel === "OUT_OF_STOCK" ? "CRITICAL"
                    : alertLevel === "CRITICAL"     ? "HIGH"
                    : "MEDIUM";

      await db.procurementRecommendation.create({
        data: {
          bakeryId,
          ingredientId,
          currentStockGrams:     newStock,
          requiredGrams:         Number(ingredient.reorderThresholdGrams),
          shortfallGrams:        shortfall,
          recommendedOrderGrams: orderGrams,
          supplierId:            ingredient.supplierId,
          estimatedCost:         Number(ingredient.costPerKg) > 0 ? (orderGrams / 1000) * Number(ingredient.costPerKg) : null,
          urgency,
        },
      });
    }
  }
}
