"use client";

/**
 * RecipeDetailActions
 *
 * Client island for the Edit and Delete buttons on the recipe detail page.
 * Keeps the detail page itself as a server component while still supporting
 * interactive drawers and confirmation dialogs.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RecipeForm } from "./recipe-form";

interface RecipeDetailActionsProps {
  recipe: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    yieldQuantity: number;
    yieldUnit: string;
    wastageBufferPercent: number;
    shelfLifeHours: number;
    ingredients: Array<{
      ingredientId: string;
      quantityGrams: number;
      displayUnit: string;
      isOptional: boolean;
      notes: string | null;
    }>;
    stages: Array<{
      order: number;
      type: string;
      name: string;
      durationMinutes: number;
      requiresOven: boolean;
      ovenTempCelsius: number | null;
      notes: string | null;
    }>;
  };
}

export function RecipeDetailActions({ recipe }: RecipeDetailActionsProps) {
  const router = useRouter();
  const [editOpen,   setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, startDelete]   = useTransition();

  function handleDeleteConfirm() {
    startDelete(async () => {
      const res = await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard/recipes");
        router.refresh();
      }
      setDeleteOpen(false);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Pencil className="w-3.5 h-3.5" />}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      </div>

      {/* Edit drawer */}
      <Drawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit: ${recipe.name}`}
        subtitle="Update this recipe's details, ingredients, and stages."
        width="xl"
      >
        <RecipeForm
          initialData={{
            id:                   recipe.id,
            name:                 recipe.name,
            category:             recipe.category as any,
            description:          recipe.description ?? "",
            yieldQuantity:        recipe.yieldQuantity,
            yieldUnit:            recipe.yieldUnit,
            wastageBufferPercent: Number(recipe.wastageBufferPercent),
            shelfLifeHours:       recipe.shelfLifeHours,
            ingredients:          recipe.ingredients.map((i) => ({
              ...i,
              quantityGrams: Number(i.quantityGrams),
            })),
            stages: recipe.stages.map((s) => ({
              ...s,
              type: s.type as any,
            })),
          }}
          onSuccess={() => {
            setEditOpen(false);
            router.refresh();
          }}
          onCancel={() => setEditOpen(false)}
        />
      </Drawer>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete "${recipe.name}"?`}
        message="This recipe will be deactivated and removed from the library. Existing production schedules that reference it are not affected."
        confirmLabel="Delete recipe"
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
