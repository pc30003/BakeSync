import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, created, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const IngredientSchema = z.object({
  ingredientId: z.string(),
  quantityGrams: z.number().positive(),
  displayUnit: z.string().default("g"),
  isOptional: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

const StageSchema = z.object({
  order: z.number().int().positive(),
  type: z.enum(["MIX","AUTOLYSE","BULK_FERMENT","SHAPE","PROOF","RETARD","BAKE","COOL","FINISH","PACK"]),
  name: z.string(),
  durationMinutes: z.number().int().positive(),
  requiresOven: z.boolean().default(false),
  ovenTempCelsius: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const CreateRecipeSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["BREAD","PASTRY","CAKE","BISCUIT","VIENNOISERIE","SAVOURY","OTHER"]),
  description: z.string().nullable().optional(),
  yieldQuantity: z.number().int().positive(),
  yieldUnit: z.string().default("pieces"),
  batchSizeMultiplier: z.number().positive().default(1),
  wastageBufferPercent: z.number().min(0).max(100).default(3),
  shelfLifeHours: z.number().int().positive().default(24),
  isActive: z.boolean().default(true),
  ingredients: z.array(IngredientSchema).min(1),
  stages: z.array(StageSchema).min(1),
});

// GET /api/recipes
export async function GET(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") ?? undefined;
    const active   = searchParams.get("active");

    const recipes = await db.recipe.findMany({
      where: {
        bakeryId: session!.user.bakeryId,
        ...(category && { category: category as any }),
        ...(active !== null && { isActive: active === "true" }),
      },
      include: {
        ingredients: {
          include: { ingredient: { select: { id: true, name: true, unit: true } } },
        },
        stages: { orderBy: { order: "asc" } },
      },
      orderBy: { name: "asc" },
    });

    return ok(recipes);
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/recipes
export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = CreateRecipeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { ingredients, stages, ...recipeData } = parsed.data;

    const recipe = await db.recipe.create({
      data: {
        ...recipeData,
        bakeryId: session!.user.bakeryId,
        ingredients: { create: ingredients },
        stages:      { create: stages },
      },
      include: {
        ingredients: true,
        stages: { orderBy: { order: "asc" } },
      },
    });

    return created(recipe);
  } catch (err) {
    return serverError(err);
  }
}
