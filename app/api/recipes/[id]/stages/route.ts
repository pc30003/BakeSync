/**
 * PUT /api/recipes/[id]/stages
 *
 * Replaces ALL stage rows on a recipe in one atomic transaction.
 * Used by the recipe edit form when saving stage changes.
 * HEAD_BAKER only.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, notFound, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const StagesSchema = z.object({
  stages: z.array(z.object({
    order:           z.number().int().min(1),
    type:            z.enum(["MIX","AUTOLYSE","BULK_FERMENT","SHAPE","PROOF","RETARD","BAKE","COOL","FINISH","PACK"]),
    name:            z.string().min(1),
    durationMinutes: z.number().int().min(1),
    requiresOven:    z.boolean().default(false),
    ovenTempCelsius: z.number().int().nullable().optional(),
    notes:           z.string().nullable().optional(),
  })).min(1, "A recipe must have at least one stage"),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const body   = await req.json();
    const parsed = StagesSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const recipe = await db.recipe.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
    });
    if (!recipe) return notFound("Recipe");

    const [, , updated] = await db.$transaction([
      db.recipeStage.deleteMany({ where: { recipeId: params.id } }),
      db.recipeStage.createMany({
        data: parsed.data.stages.map((s) => ({
          recipeId:        params.id,
          order:           s.order,
          type:            s.type,
          name:            s.name,
          durationMinutes: s.durationMinutes,
          requiresOven:    s.requiresOven,
          ovenTempCelsius: s.ovenTempCelsius ?? null,
          notes:           s.notes ?? null,
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
