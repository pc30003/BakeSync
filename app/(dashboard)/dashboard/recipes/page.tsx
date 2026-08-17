import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { RecipeListClient } from "@/components/recipes/recipe-list-client";

export const metadata: Metadata = { title: "Recipes" };

export const revalidate = 2;

export default async function RecipesPage() {
  const session = await auth();
  const bakeryId = session!.user.bakeryId;

  const recipes = await db.recipe.findMany({
    where: { bakeryId, isActive: true },
    include: {
      ingredients: {
        include: { ingredient: { select: { name: true } } },
      },
      stages: { orderBy: { order: "asc" } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <RecipeListClient
        initialRecipes={recipes as any}
        isHeadBaker={session!.user.role === "HEAD_BAKER"}
      />
    </div>
  );
}
