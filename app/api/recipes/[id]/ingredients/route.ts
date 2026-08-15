/**
 * PUT /api/recipes/[id]/ingredients
 *
 * Replaces ALL ingredient rows on a recipe in one atomic transaction.
 * Used by the recipe edit form when saving ingredient changes.
 * HEAD_BAKER only.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, notFound, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const IngredientsSchema = z.object({
  ingredients: z.array(z.object({
    ingredientId:  z.string().min(1),
    quantityGrams: z.number().positive(),
    displayUnit:   z.string().default("g"),
    isOptional:    z.boolean().default(false),
    notes:         z.string().nullable().optional(),
  })).min(1, "A recipe must have at least one ingredient"),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const body   = await req.json();
    const parsed = IngredientsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const recipe = await db.recipe.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
    });
    if (!recipe) return notFound("Recipe");

    // Replace all ingredients atomically
    const [, , updated] = await db.$transaction([
      db.recipeIngredient.deleteMany({ where: { recipeId: params.id } }),
      db.recipeIngredient.createMany({
        data: parsed.data.ingredients.map((ing) => ({
          recipeId:      params.id,
          ingredientId:  ing.ingredientId,
          quantityGrams: ing.quantityGrams,
          displayUnit:   ing.displayUnit,
          isOptional:    ing.isOptional,
          notes:         ing.notes ?? null,
        })),
      }),
      db.recipe.findUniqueOrThrow({
        where:   { id: params.id },
        include: { ingredients: { include: { ingredient: true } }, stages: { orderBy: { order: "asc" } } },
      }),
    ]);

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}
