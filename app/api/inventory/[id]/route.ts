import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, notFound, serverError, validationError, requireAuth } from "@/lib/api-helpers";
import { handleStockChange } from "@/lib/stock-actions";

const UpdateIngredientSchema = z.object({
  name: z.string().min(1).optional(),
  stockGrams: z.number().nonnegative().optional(),
  reorderThresholdGrams: z.number().nonnegative().optional(),
  criticalThresholdGrams: z.number().nonnegative().optional(),
  costPerKg: z.number().nonnegative().optional(),
  supplierId: z.string().nullable().optional(),
  isTracked: z.boolean().optional(),
});

// GET /api/inventory/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const ingredient = await db.ingredient.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
      include: {
        supplier: true,
        lots: { orderBy: { expiryDate: "asc" } },
      },
    });

    if (!ingredient) return notFound("Ingredient");
    return ok(ingredient);
  } catch (err) {
    return serverError(err);
  }
}

// PATCH /api/inventory/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await requireAuth(["HEAD_BAKER", "PURCHASING_MANAGER"]);
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = UpdateIngredientSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await db.ingredient.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
    });
    if (!existing) return notFound("Ingredient");

    // Recompute alert level based on updated stock
    const newStock = parsed.data.stockGrams ?? Number(existing.stockGrams);
    const critical = parsed.data.criticalThresholdGrams ?? Number(existing.criticalThresholdGrams);
    const reorder  = parsed.data.reorderThresholdGrams  ?? Number(existing.reorderThresholdGrams);

    const alertLevel =
      newStock <= 0       ? "OUT_OF_STOCK" :
      newStock <= critical ? "CRITICAL" :
      newStock <= reorder  ? "LOW" :
      "OK";

    const updated = await db.ingredient.update({
      where: { id: params.id },
      data: { ...parsed.data, alertLevel },
    });

    // Auto-generate alerts and procurement recommendations
    await handleStockChange({
      ingredientId: params.id,
      bakeryId:     session!.user.bakeryId,
      newStock,
      alertLevel:   alertLevel as "OK" | "LOW" | "CRITICAL" | "OUT_OF_STOCK",
    });

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}
