import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, noContent, notFound, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const UpdateRecipeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  yieldQuantity: z.number().int().positive().optional(),
  yieldUnit: z.string().optional(),
  batchSizeMultiplier: z.number().positive().optional(),
  wastageBufferPercent: z.number().min(0).max(100).optional(),
  shelfLifeHours: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/recipes/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const recipe = await db.recipe.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
      include: {
        ingredients: {
          include: { ingredient: true },
        },
        stages: { orderBy: { order: "asc" } },
      },
    });

    if (!recipe) return notFound("Recipe");
    return ok(recipe);
  } catch (err) {
    return serverError(err);
  }
}

// PATCH /api/recipes/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = UpdateRecipeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await db.recipe.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
    });
    if (!existing) return notFound("Recipe");

    const updated = await db.recipe.update({
      where: { id: params.id },
      data: parsed.data,
      include: {
        ingredients: { include: { ingredient: true } },
        stages: { orderBy: { order: "asc" } },
      },
    });

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}

// DELETE /api/recipes/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const existing = await db.recipe.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
    });
    if (!existing) return notFound("Recipe");

    // Soft delete — deactivate rather than destroy
    await db.recipe.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return noContent();
  } catch (err) {
    return serverError(err);
  }
}
