import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, notFound, serverError, validationError, requireAuth, error } from "@/lib/api-helpers";
import { computeAlertLevel, handleStockChange } from "@/lib/stock-actions";

const DeductSchema = z.object({
  ingredientId: z.string(),
  quantityGrams: z.number().positive(),
  reason: z.enum(["PRODUCTION", "WASTAGE", "SPOILAGE", "ADJUSTMENT", "STOCKTAKE"]),
  referenceId: z.string().nullable().optional(),
});

// POST /api/inventory/deduct — log a stock deduction
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = DeductSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const ingredient = await db.ingredient.findFirst({
      where: { id: parsed.data.ingredientId, bakeryId: session!.user.bakeryId },
    });
    if (!ingredient) return notFound("Ingredient");

    const currentStock = Number(ingredient.stockGrams);
    if (parsed.data.quantityGrams > currentStock) {
      return error(
        `Insufficient stock. Available: ${currentStock}g, requested: ${parsed.data.quantityGrams}g`,
        409
      );
    }

    const newStock = currentStock - parsed.data.quantityGrams;
    const critical = Number(ingredient.criticalThresholdGrams);
    const reorder  = Number(ingredient.reorderThresholdGrams);

    const alertLevel =
      newStock <= 0       ? "OUT_OF_STOCK" :
      newStock <= critical ? "CRITICAL" :
      newStock <= reorder  ? "LOW" :
      "OK";

    // Transactionally deduct and log
    const [deduction] = await db.$transaction([
      db.stockDeduction.create({
        data: {
          bakeryId:     session!.user.bakeryId,
          ingredientId: parsed.data.ingredientId,
          quantityGrams: parsed.data.quantityGrams,
          reason:       parsed.data.reason,
          referenceId:  parsed.data.referenceId ?? null,
          loggedById:   session!.user.id,
        },
      }),
      db.ingredient.update({
        where: { id: parsed.data.ingredientId },
        data:  { stockGrams: newStock, alertLevel },
      }),
    ]);

    // Auto-generate alerts and procurement recommendations
    await handleStockChange({
      ingredientId: parsed.data.ingredientId,
      bakeryId:     session!.user.bakeryId,
      newStock,
      alertLevel:   alertLevel as "OK" | "LOW" | "CRITICAL" | "OUT_OF_STOCK",
    });

    return ok({ deduction, newStockGrams: newStock, alertLevel });
  } catch (err) {
    return serverError(err);
  }
}
