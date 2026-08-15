import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, created, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const WastageSchema = z.object({
  ingredientId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  quantityGrams: z.number().positive(),
  reason: z.string().min(1),
  shiftDate: z.string().datetime(),
});

// GET /api/inventory/wastage — list wastage logs
export async function GET(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to   = searchParams.get("to");

    const logs = await db.wastageLog.findMany({
      where: {
        bakeryId: session!.user.bakeryId,
        ...(from || to ? {
          shiftDate: {
            ...(from && { gte: new Date(from) }),
            ...(to   && { lte: new Date(to)   }),
          },
        } : {}),
      },
      include: {
        ingredient: { select: { id: true, name: true } },
        loggedBy:   { select: { id: true, name: true } },
      },
      orderBy: { shiftDate: "desc" },
    });

    return ok(logs);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/inventory/wastage — log wastage
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = WastageSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const result = await db.$transaction(async (tx) => {
      // Create the wastage log
      const log = await tx.wastageLog.create({
        data: {
          bakeryId:     session!.user.bakeryId,
          ingredientId: parsed.data.ingredientId ?? null,
          productId:    parsed.data.productId ?? null,
          productName:  parsed.data.productName ?? null,
          quantityGrams: parsed.data.quantityGrams,
          reason:       parsed.data.reason,
          shiftDate:    new Date(parsed.data.shiftDate),
          loggedById:   session!.user.id,
        },
      });

      // If an ingredient was selected, deduct stock
      if (parsed.data.ingredientId) {
        const ingredient = await tx.ingredient.findUnique({
          where: { id: parsed.data.ingredientId },
        });

        if (ingredient) {
          const newStock = Math.max(0, Number(ingredient.stockGrams) - parsed.data.quantityGrams);

          // Determine new alert level
          let alertLevel = "OK";
          if (newStock <= 0) alertLevel = "OUT_OF_STOCK";
          else if (newStock <= Number(ingredient.criticalThresholdGrams)) alertLevel = "CRITICAL";
          else if (newStock <= Number(ingredient.reorderThresholdGrams)) alertLevel = "LOW";

          await tx.ingredient.update({
            where: { id: parsed.data.ingredientId },
            data:  { stockGrams: newStock, alertLevel },
          });
        }
      }

      return log;
    });

    return created(result);
  } catch (err) {
    return serverError(err);
  }
}
