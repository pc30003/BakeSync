"use client";

/**
 * RecipeListClient
 *
 * Client-side wrapper for the recipe library page.
 * Manages:
 *  - "New Recipe" drawer
 *  - "Edit" drawer (pre-populated with existing data)
 *  - Delete confirmation dialog
 *  - Optimistic removal on delete
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, ExternalLink, Flame } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { RecipeForm } from "./recipe-form";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecipeStage {
  order: number;
  type: string;
  name: string;
  durationMinutes: number;
  requiresOven: boolean;
  ovenTempCelsius: number | null;
  notes: string | null;
}

interface RecipeIngredientRow {
  ingredientId: string;
  quantityGrams: number;
  displayUnit: string;
  isOptional: boolean;
  notes: string | null;
  ingredient?: { name: string };
}

interface Recipe {
  id: string;
  name: string;
  category: string;
  description: string | null;
  yieldQuantity: number;
  yieldUnit: string;
  shelfLifeHours: number;
  wastageBufferPercent: number;
  isActive: boolean;
  ingredients: RecipeIngredientRow[];
  stages: RecipeStage[];
}

interface RecipeListClientProps {
  initialRecipes: Recipe[];
  isHeadBaker: boolean;
}

// ─── Category colours ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  BREAD:        "bg-amber-100 text-amber-800",
  PASTRY:       "bg-pink-100 text-pink-800",
  CAKE:         "bg-purple-100 text-purple-800",
  BISCUIT:      "bg-orange-100 text-orange-800",
  VIENNOISERIE: "bg-yellow-100 text-yellow-800",
  SAVOURY:      "bg-green-100 text-green-800",
  OTHER:        "bg-gray-100 text-gray-700",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipeListClient({ initialRecipes, isHeadBaker }: RecipeListClientProps) {
  const router = useRouter();

  const [recipes,      setRecipes]      = useState(initialRecipes);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editTarget,   setEditTarget]   = useState<Recipe | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [isDeleting,   startDelete]     = useTransition();

  function openCreate() {
    setEditTarget(null);
    setDrawerOpen(true);
  }

  function openEdit(recipe: Recipe) {
    setEditTarget(recipe);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditTarget(null);
  }

  function handleFormSuccess(recipeId: string) {
    closeDrawer();
    router.refresh();
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    startDelete(async () => {
      const res = await fetch(`/api/recipes/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setRecipes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      }
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Recipe Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {recipes.length} active recipe{recipes.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isHeadBaker && (
          <Button
            onClick={openCreate}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New recipe
          </Button>
        )}
      </div>

      {/* ── Recipe grid ─────────────────────────────────────────────────── */}
      {recipes.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">📖</span>}
          title="No recipes yet"
          description="Add your first product recipe to start generating production schedules."
          action={isHeadBaker ? { label: "Add recipe", onClick: openCreate } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recipes.map((recipe) => {
            const totalMins  = recipe.stages.reduce((s, st) => s + st.durationMinutes, 0);
            const activeMins = recipe.stages
              .filter((s) => !["RETARD", "BULK_FERMENT", "PROOF", "COOL"].includes(s.type))
              .reduce((s, st) => s + st.durationMinutes, 0);
            const hasOven = recipe.stages.some((s) => s.requiresOven);

            return (
              <Card
                key={recipe.id}
                className="group hover:shadow-md transition-shadow flex flex-col"
              >
                <CardContent className="pt-5 pb-4 space-y-3 flex-1">
                  {/* ── Header ─────────────────────────────────────────── */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight truncate">
                        {recipe.name}
                      </h3>
                      {recipe.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {recipe.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                        CATEGORY_COLORS[recipe.category] ?? "bg-gray-100 text-gray-700"
                      )}
                    >
                      {recipe.category}
                    </span>
                  </div>

                  {/* ── Stats row ──────────────────────────────────────── */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-muted rounded-lg px-2 py-2">
                      <p className="text-[10px] text-muted-foreground">Yield</p>
                      <p className="text-xs font-semibold">
                        {recipe.yieldQuantity} {recipe.yieldUnit}
                      </p>
                    </div>
                    <div className="bg-muted rounded-lg px-2 py-2">
                      <p className="text-[10px] text-muted-foreground">Total time</p>
                      <p className="text-xs font-semibold">{formatDuration(totalMins)}</p>
                    </div>
                    <div className="bg-muted rounded-lg px-2 py-2">
                      <p className="text-[10px] text-muted-foreground">Active</p>
                      <p className="text-xs font-semibold">{formatDuration(activeMins)}</p>
                    </div>
                  </div>

                  {/* ── Ingredient preview ─────────────────────────────── */}
                  {recipe.ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recipe.ingredients.slice(0, 4).map((ing) => (
                        <span
                          key={ing.ingredientId}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-100"
                        >
                          {ing.ingredient?.name ?? "Ingredient"}
                        </span>
                      ))}
                      {recipe.ingredients.length > 4 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                          +{recipe.ingredients.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* ── Badges ─────────────────────────────────────────── */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {recipe.stages.length} stages
                    </span>
                    {hasOven && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5" aria-hidden="true" />
                        Oven
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {recipe.shelfLifeHours}h shelf life
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {Number(recipe.wastageBufferPercent)}% buffer
                    </span>
                  </div>
                </CardContent>

                {/* ── Card footer actions ─────────────────────────────── */}
                <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
                  <Link
                    href={`/dashboard/recipes/${recipe.id}`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    View details
                  </Link>

                  {isHeadBaker && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(recipe)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors tap-target text-muted-foreground hover:text-foreground"
                        aria-label={`Edit ${recipe.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(recipe)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors tap-target text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${recipe.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit drawer ─────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editTarget ? `Edit: ${editTarget.name}` : "New recipe"}
        subtitle={
          editTarget
            ? "Update this recipe's details, ingredients, and stages."
            : "Add a new product to your recipe library."
        }
        width="xl"
      >
        <RecipeForm
          initialData={
            editTarget
              ? {
                  id:                   editTarget.id,
                  name:                 editTarget.name,
                  category:             editTarget.category as any,
                  description:          editTarget.description ?? "",
                  yieldQuantity:        editTarget.yieldQuantity,
                  yieldUnit:            editTarget.yieldUnit,
                  wastageBufferPercent: Number(editTarget.wastageBufferPercent),
                  shelfLifeHours:       editTarget.shelfLifeHours,
                  ingredients:          editTarget.ingredients.map((i) => ({
                    ingredientId:  i.ingredientId,
                    quantityGrams: Number(i.quantityGrams),
                    displayUnit:   i.displayUnit,
                    isOptional:    i.isOptional,
                    notes:         i.notes,
                  })),
                  stages:               editTarget.stages.map((s) => ({
                    ...s,
                    type: s.type as any,
                  })),
                }
              : undefined
          }
          onSuccess={handleFormSuccess}
          onCancel={closeDrawer}
        />
      </Drawer>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        message="This recipe will be deactivated and removed from the library. Production schedules that reference it will not be affected."
        confirmLabel="Delete recipe"
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
