import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, created, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const CreateIngredientSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["FLOUR","GRAIN","DAIRY","FAT","SWEETENER","LEAVENING","EGG","FRUIT","NUT","CHOCOLATE","SPICE","SALT","LIQUID","PACKAGING","OTHER"]),
  unit: z.string().default("g"),
  stockGrams: z.number().nonnegative().default(0),
  reorderThresholdGrams: z.number().nonnegative(),
  criticalThresholdGrams: z.number().nonnegative(),
  costPerKg: z.number().nonnegative().default(0),
  supplierId: z.string().nullable().optional(),
  isTracked: z.boolean().default(true),
});

// GET /api/inventory
export async function GET(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const alert    = searchParams.get("alert") ?? undefined;
    const category = searchParams.get("category") ?? undefined;

    const ingredients = await db.ingredient.findMany({
      where: {
        bakeryId: session!.user.bakeryId,
        isTracked: true,
        ...(alert    && { alertLevel: alert as any }),
        ...(category && { category:   category as any }),
      },
      include: {
        supplier: { select: { id: true, name: true, leadTimeDays: true } },
        lots: {
          orderBy: { expiryDate: "asc" },  // FEFO order
          take: 5,
        },
      },
      orderBy: [{ alertLevel: "asc" }, { name: "asc" }],
    });

    return ok(ingredients);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/inventory
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER", "PURCHASING_MANAGER"]);
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = CreateIngredientSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const ingredient = await db.ingredient.create({
      data: {
        ...parsed.data,
        bakeryId: session!.user.bakeryId,
        alertLevel: "OK",
      },
    });

    return created(ingredient);
  } catch (err) {
    return serverError(err);
  }
}
