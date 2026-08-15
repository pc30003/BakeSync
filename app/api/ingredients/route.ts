/**
 * GET /api/ingredients
 *
 * Lightweight list of all tracked ingredients for use in form pickers.
 * Returns only id, name, unit, category — no stock details needed here.
 * Available to all authenticated roles.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, requireAuth } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const ingredients = await db.ingredient.findMany({
      where: {
        bakeryId:  session!.user.bakeryId,
        isTracked: true,
      },
      select: {
        id:       true,
        name:     true,
        unit:     true,
        category: true,
        stockGrams: true,
        alertLevel: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return ok(ingredients);
  } catch (err) {
    return serverError(err);
  }
}
