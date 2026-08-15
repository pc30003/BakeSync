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

    const log = await db.wastageLog.create({
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

    return created(log);
  } catch (err) {
    return serverError(err);
  }
}
