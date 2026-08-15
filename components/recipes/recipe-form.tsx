"use client";

/**
 * RecipeForm — multi-step form for creating and editing recipes.
 *
 * Step 1: Details   — name, category, description, yield, shelf life, wastage buffer
 * Step 2: Ingredients — add/remove/edit ingredient rows with quantity in grams
 * Step 3: Stages    — add/remove/reorder baking stages with duration and oven settings
 *
 * Works for both CREATE (no initialData) and EDIT (initialData provided).
 * On success calls onSuccess(recipeId) so the parent can navigate or refresh.
 */

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, ChevronUp, ChevronDown,
  ChevronRight, ChevronLeft, Check, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "BREAD" | "PASTRY" | "CAKE" | "BISCUIT" | "VIENNOISERIE" | "SAVOURY" | "OTHER";
type StageType = "MIX" | "AUTOLYSE" | "BULK_FERMENT" | "SHAPE" | "PROOF" | "RETARD" | "BAKE" | "COOL" | "FINISH" | "PACK";

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  category: string;
  stockGrams: number;
  alertLevel: string;
}

interface IngredientRow {
  _key: string;           // local-only key for React lists
  ingredientId: string;
  quantityGrams: string;  // string for input control
  displayUnit: string;
  isOptional: boolean;
  notes: string;
}

interface StageRow {
  _key: string;
  order: number;
  type: StageType;
  name: string;
  durationMinutes: string;
  requiresOven: boolean;
  ovenTempCelsius: string;
  notes: string;
}

interface RecipeFormProps {
  /** When provided the form is in edit mode */
  initialData?: {
    id: string;
    name: string;
    category: Category;
    description: string;
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
      type: StageType;
      name: string;
      durationMinutes: number;
      requiresOven: boolean;
      ovenTempCelsius: number | null;
      notes: string | null;
    }>;
  };
  onSuccess: (recipeId: string) => void;
  onCancel: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "BREAD",        label: "Bread" },
  { value: "PASTRY",       label: "Pastry" },
  { value: "CAKE",         label: "Cake" },
  { value: "BISCUIT",      label: "Biscuit" },
  { value: "VIENNOISERIE", label: "Viennoiserie" },
  { value: "SAVOURY",      label: "Savoury" },
  { value: "OTHER",        label: "Other" },
];

const STAGE_TYPES: { value: StageType; label: string }[] = [
  { value: "MIX",          label: "Mix" },
  { value: "AUTOLYSE",     label: "Autolyse" },
  { value: "BULK_FERMENT", label: "Bulk ferment" },
  { value: "SHAPE",        label: "Shape" },
  { value: "PROOF",        label: "Proof" },
  { value: "RETARD",       label: "Retard (cold)" },
  { value: "BAKE",         label: "Bake" },
  { value: "COOL",         label: "Cool" },
  { value: "FINISH",       label: "Finish / Decorate" },
  { value: "PACK",         label: "Pack" },
];

const INPUT_CLASS =
  "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-ring transition-shadow";

const LABEL_CLASS = "block text-sm font-medium text-foreground mb-1.5";

let keyCounter = 0;
const nextKey = () => String(++keyCounter);

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipeForm({ initialData, onSuccess, onCancel }: RecipeFormProps) {
  const router       = useRouter();
  const [step, setStep]         = useState<1 | 2 | 3>(1);
  const [isPending, startTrans] = useTransition();
  const [error, setError]       = useState<string | null>(null);

  // ── Step 1: Details ──────────────────────────────────────────────────────
  const [details, setDetails] = useState({
    name:                initialData?.name                ?? "",
    category:            (initialData?.category           ?? "BREAD") as Category,
    description:         initialData?.description         ?? "",
    yieldQuantity:       String(initialData?.yieldQuantity ?? "12"),
    yieldUnit:           initialData?.yieldUnit           ?? "pieces",
    wastageBufferPercent:String(initialData?.wastageBufferPercent ?? "3"),
    shelfLifeHours:      String(initialData?.shelfLifeHours ?? "24"),
  });

  // ── Step 2: Ingredients ──────────────────────────────────────────────────
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    initialData?.ingredients.map((ing) => ({
      _key:          nextKey(),
      ingredientId:  ing.ingredientId,
      quantityGrams: String(ing.quantityGrams),
      displayUnit:   ing.displayUnit,
      isOptional:    ing.isOptional,
      notes:         ing.notes ?? "",
    })) ?? [{ _key: nextKey(), ingredientId: "", quantityGrams: "", displayUnit: "g", isOptional: false, notes: "" }]
  );
  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);

  // ── Step 3: Stages ───────────────────────────────────────────────────────
  const [stages, setStages] = useState<StageRow[]>(() =>
    initialData?.stages.map((s) => ({
      _key:            nextKey(),
      order:           s.order,
      type:            s.type,
      name:            s.name,
      durationMinutes: String(s.durationMinutes),
      requiresOven:    s.requiresOven,
      ovenTempCelsius: String(s.ovenTempCelsius ?? ""),
      notes:           s.notes ?? "",
    })) ?? [{ _key: nextKey(), order: 1, type: "MIX", name: "Mix dough", durationMinutes: "20", requiresOven: false, ovenTempCelsius: "", notes: "" }]
  );

  // Fetch ingredient options once
  useEffect(() => {
    fetch("/api/ingredients")
      .then((r) => r.json())
      .then((json) => setIngredientOptions(json.data ?? []))
      .catch(() => {});
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  function validateStep1(): string | null {
    if (!details.name.trim())                 return "Recipe name is required.";
    if (!details.yieldQuantity || Number(details.yieldQuantity) < 1)
                                              return "Yield quantity must be at least 1.";
    if (!details.yieldUnit.trim())            return "Yield unit is required.";
    return null;
  }

  function validateStep2(): string | null {
    if (ingredients.length === 0)             return "Add at least one ingredient.";
    for (const ing of ingredients) {
      if (!ing.ingredientId)                  return "Select an ingredient for every row.";
      if (!ing.quantityGrams || Number(ing.quantityGrams) <= 0)
                                              return "Enter a quantity greater than 0 for every ingredient.";
    }
    return null;
  }

  function validateStep3(): string | null {
    if (stages.length === 0)                  return "Add at least one stage.";
    for (const s of stages) {
      if (!s.name.trim())                     return "Every stage needs a name.";
      if (!s.durationMinutes || Number(s.durationMinutes) < 1)
                                              return "Every stage needs a duration of at least 1 minute.";
    }
    return null;
  }

  function goNext() {
    const err = step === 1 ? validateStep1() : validateStep2();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => (s < 3 ? (s + 1) as 1 | 2 | 3 : s));
  }

  function goBack() {
    setError(null);
    setStep((s) => (s > 1 ? (s - 1) as 1 | 2 | 3 : s));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const err = validateStep3();
    if (err) { setError(err); return; }
    setError(null);

    startTrans(async () => {
      try {
        const isEdit = !!initialData;

        // 1. Create or update the recipe core
        const recipePayload = {
          name:                details.name.trim(),
          category:            details.category,
          description:         details.description.trim() || null,
          yieldQuantity:       Number(details.yieldQuantity),
          yieldUnit:           details.yieldUnit.trim(),
          wastageBufferPercent: Number(details.wastageBufferPercent),
          shelfLifeHours:      Number(details.shelfLifeHours),
          ...(!isEdit && {
            ingredients: ingredients.map((ing) => ({
              ingredientId:  ing.ingredientId,
              quantityGrams: Number(ing.quantityGrams),
              displayUnit:   ing.displayUnit,
              isOptional:    ing.isOptional,
              notes:         ing.notes || null,
            })),
            stages: stages.map((s, i) => ({
              order:           i + 1,
              type:            s.type,
              name:            s.name.trim(),
              durationMinutes: Number(s.durationMinutes),
              requiresOven:    s.requiresOven,
              ovenTempCelsius: s.requiresOven && s.ovenTempCelsius ? Number(s.ovenTempCelsius) : null,
              notes:           s.notes || null,
            })),
          }),
        };

        const url    = isEdit ? `/api/recipes/${initialData.id}` : "/api/recipes";
        const method = isEdit ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(recipePayload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Failed to save recipe");
        }
        const json = await res.json();
        const recipeId: string = isEdit ? initialData.id : json.data.id;

        // 2. For edits, separately replace ingredients and stages
        if (isEdit) {
          const [ingRes, stgRes] = await Promise.all([
            fetch(`/api/recipes/${recipeId}/ingredients`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ingredients: ingredients.map((ing) => ({
                  ingredientId:  ing.ingredientId,
                  quantityGrams: Number(ing.quantityGrams),
                  displayUnit:   ing.displayUnit,
                  isOptional:    ing.isOptional,
                  notes:         ing.notes || null,
                })),
              }),
            }),
            fetch(`/api/recipes/${recipeId}/stages`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stages: stages.map((s, i) => ({
                  order:           i + 1,
                  type:            s.type,
                  name:            s.name.trim(),
                  durationMinutes: Number(s.durationMinutes),
                  requiresOven:    s.requiresOven,
                  ovenTempCelsius: s.requiresOven && s.ovenTempCelsius ? Number(s.ovenTempCelsius) : null,
                  notes:           s.notes || null,
                })),
              }),
            }),
          ]);
          if (!ingRes.ok || !stgRes.ok) {
            throw new Error("Failed to update recipe details — please try again.");
          }
        }

        router.refresh();
        onSuccess(recipeId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error. Please try again.");
      }
    });
  }

  // ── Ingredient row helpers ─────────────────────────────────────────────────
  function addIngredient() {
    setIngredients((prev) => [
      ...prev,
      { _key: nextKey(), ingredientId: "", quantityGrams: "", displayUnit: "g", isOptional: false, notes: "" },
    ]);
  }

  function removeIngredient(key: string) {
    setIngredients((prev) => prev.filter((i) => i._key !== key));
  }

  function updateIngredient(key: string, field: keyof IngredientRow, value: string | boolean) {
    setIngredients((prev) =>
      prev.map((i) => {
        if (i._key !== key) return i;
        const updated = { ...i, [field]: value };
        // Auto-fill unit when ingredient is selected
        if (field === "ingredientId") {
          const opt = ingredientOptions.find((o) => o.id === value);
          if (opt) updated.displayUnit = opt.unit;
        }
        return updated;
      })
    );
  }

  // ── Stage row helpers ──────────────────────────────────────────────────────
  function addStage() {
    setStages((prev) => [
      ...prev,
      {
        _key: nextKey(),
        order: prev.length + 1,
        type: "MIX",
        name: "",
        durationMinutes: "15",
        requiresOven: false,
        ovenTempCelsius: "",
        notes: "",
      },
    ]);
  }

  function removeStage(key: string) {
    setStages((prev) =>
      prev.filter((s) => s._key !== key).map((s, i) => ({ ...s, order: i + 1 }))
    );
  }

  function updateStage(key: string, field: keyof StageRow, value: string | boolean | number) {
    setStages((prev) =>
      prev.map((s) => s._key !== key ? s : { ...s, [field]: value })
    );
  }

  function moveStage(key: string, dir: "up" | "down") {
    setStages((prev) => {
      const idx = prev.findIndex((s) => s._key === key);
      if (idx < 0) return prev;
      if (dir === "up"   && idx === 0)              return prev;
      if (dir === "down" && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const stepLabels = ["Details", "Ingredients", "Stages"];

  return (
    <div className="flex flex-col h-full max-h-[90vh]">

      {/* ── Step indicator ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-border shrink-0">
        {stepLabels.map((label, idx) => {
          const num      = idx + 1;
          const isActive = step === num;
          const isDone   = step > num;
          return (
            <div key={label} className="flex items-center gap-2">
              {idx > 0 && <div className="w-8 h-px bg-border" />}
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    isActive ? "bg-primary text-white" :
                    isDone   ? "bg-green-500 text-white" :
                               "bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="w-3 h-3" /> : num}
                </div>
                <span className={cn(
                  "text-sm font-medium hidden sm:block",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div role="alert" className="mx-6 mt-4 px-3 py-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg shrink-0">
          {error}
        </div>
      )}

      {/* ── Form body (scrollable) ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* ── STEP 1: Details ─────────────────────────────────────────── */}
        {step === 1 && (
          <fieldset className="space-y-5" aria-label="Recipe details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div className="sm:col-span-2">
                <label htmlFor="name" className={LABEL_CLASS}>
                  Product name <span className="text-destructive">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="e.g. Butter Croissant"
                  value={details.name}
                  onChange={(e) => setDetails((p) => ({ ...p, name: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className={LABEL_CLASS}>
                  Category <span className="text-destructive">*</span>
                </label>
                <select
                  id="category"
                  value={details.category}
                  onChange={(e) => setDetails((p) => ({ ...p, category: e.target.value as Category }))}
                  className={INPUT_CLASS}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Yield quantity + unit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="yieldQty" className={LABEL_CLASS}>
                    Yield qty <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="yieldQty"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="12"
                    value={details.yieldQuantity}
                    onChange={(e) => setDetails((p) => ({ ...p, yieldQuantity: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="yieldUnit" className={LABEL_CLASS}>
                    Unit <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="yieldUnit"
                    type="text"
                    placeholder="pieces"
                    value={details.yieldUnit}
                    onChange={(e) => setDetails((p) => ({ ...p, yieldUnit: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Shelf life */}
              <div>
                <label htmlFor="shelfLife" className={LABEL_CLASS}>
                  Shelf life (hours)
                </label>
                <input
                  id="shelfLife"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="24"
                  value={details.shelfLifeHours}
                  onChange={(e) => setDetails((p) => ({ ...p, shelfLifeHours: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </div>

              {/* Wastage buffer */}
              <div>
                <label htmlFor="wastage" className={LABEL_CLASS}>
                  Wastage buffer (%)
                  <span className="ml-1 text-[11px] text-muted-foreground font-normal">
                    Empirical loss e.g. batter in bowls
                  </span>
                </label>
                <input
                  id="wastage"
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  placeholder="3"
                  value={details.wastageBufferPercent}
                  onChange={(e) => setDetails((p) => ({ ...p, wastageBufferPercent: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label htmlFor="description" className={LABEL_CLASS}>
                  Description
                  <span className="ml-1 text-[11px] text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  id="description"
                  rows={3}
                  placeholder="Brief description of this product…"
                  value={details.description}
                  onChange={(e) => setDetails((p) => ({ ...p, description: e.target.value }))}
                  className={cn(INPUT_CLASS, "resize-none")}
                />
              </div>
            </div>
          </fieldset>
        )}

        {/* ── STEP 2: Ingredients ─────────────────────────────────────── */}
        {step === 2 && (
          <fieldset className="space-y-3" aria-label="Recipe ingredients">
            <p className="text-xs text-muted-foreground">
              All quantities are in <strong>grams</strong> — this is what the agent uses for stock
              deductions. Quantities are per base recipe yield ({details.yieldQuantity} {details.yieldUnit}).
            </p>

            <div className="space-y-3">
              {ingredients.map((ing, idx) => {
                const opt = ingredientOptions.find((o) => o.id === ing.ingredientId);
                const isLow = opt && (opt.alertLevel === "LOW" || opt.alertLevel === "CRITICAL" || opt.alertLevel === "OUT_OF_STOCK");

                return (
                  <div
                    key={ing._key}
                    className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Ingredient {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeIngredient(ing._key)}
                        className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors tap-target"
                        aria-label={`Remove ingredient ${idx + 1}`}
                        disabled={ingredients.length === 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Ingredient select */}
                    <div>
                      <label htmlFor={`ing-id-${ing._key}`} className={LABEL_CLASS}>
                        Ingredient <span className="text-destructive">*</span>
                      </label>
                      <select
                        id={`ing-id-${ing._key}`}
                        value={ing.ingredientId}
                        onChange={(e) => updateIngredient(ing._key, "ingredientId", e.target.value)}
                        className={INPUT_CLASS}
                      >
                        <option value="">— Select ingredient —</option>
                        {ingredientOptions.map((o) => (
                          <option key={o.id} value={o.id}>{o.name} ({o.category})</option>
                        ))}
                      </select>
                      {isLow && (
                        <p className="mt-1 text-xs text-amber-600">
                          ⚠️ Current stock is {opt!.alertLevel.replace("_", " ").toLowerCase()}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Quantity */}
                      <div>
                        <label htmlFor={`ing-qty-${ing._key}`} className={LABEL_CLASS}>
                          Quantity (g) <span className="text-destructive">*</span>
                        </label>
                        <input
                          id={`ing-qty-${ing._key}`}
                          type="number"
                          min="0.1"
                          step="0.1"
                          placeholder="0"
                          value={ing.quantityGrams}
                          onChange={(e) => updateIngredient(ing._key, "quantityGrams", e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </div>

                      {/* Display unit */}
                      <div>
                        <label htmlFor={`ing-unit-${ing._key}`} className={LABEL_CLASS}>
                          Display unit
                        </label>
                        <input
                          id={`ing-unit-${ing._key}`}
                          type="text"
                          placeholder="g"
                          value={ing.displayUnit}
                          onChange={(e) => updateIngredient(ing._key, "displayUnit", e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>

                    {/* Optional toggle */}
                    <div className="flex items-center gap-2">
                      <input
                        id={`ing-opt-${ing._key}`}
                        type="checkbox"
                        checked={ing.isOptional}
                        onChange={(e) => updateIngredient(ing._key, "isOptional", e.target.checked)}
                        className="rounded border-input w-4 h-4 accent-primary"
                      />
                      <label htmlFor={`ing-opt-${ing._key}`} className="text-sm text-muted-foreground select-none cursor-pointer">
                        Optional ingredient
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={addIngredient}
              className="w-full"
            >
              Add ingredient
            </Button>
          </fieldset>
        )}

        {/* ── STEP 3: Stages ──────────────────────────────────────────── */}
        {step === 3 && (
          <fieldset className="space-y-3" aria-label="Baking stages">
            <p className="text-xs text-muted-foreground">
              Define each stage of the baking process in order. The agent uses these
              timings to schedule batches and allocate oven slots.
            </p>

            <div className="space-y-3">
              {stages.map((stage, idx) => (
                <div
                  key={stage._key}
                  className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
                >
                  {/* Row header */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
                      Stage {idx + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStage(stage._key, "up")}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-muted transition-colors tap-target disabled:opacity-30"
                        aria-label="Move stage up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStage(stage._key, "down")}
                        disabled={idx === stages.length - 1}
                        className="p-1 rounded hover:bg-muted transition-colors tap-target disabled:opacity-30"
                        aria-label="Move stage down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStage(stage._key)}
                        disabled={stages.length === 1}
                        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors tap-target disabled:opacity-30"
                        aria-label={`Remove stage ${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Stage name */}
                    <div>
                      <label htmlFor={`stg-name-${stage._key}`} className={LABEL_CLASS}>
                        Stage name <span className="text-destructive">*</span>
                      </label>
                      <input
                        id={`stg-name-${stage._key}`}
                        type="text"
                        placeholder="e.g. Bulk ferment"
                        value={stage.name}
                        onChange={(e) => updateStage(stage._key, "name", e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    {/* Stage type */}
                    <div>
                      <label htmlFor={`stg-type-${stage._key}`} className={LABEL_CLASS}>
                        Type
                      </label>
                      <select
                        id={`stg-type-${stage._key}`}
                        value={stage.type}
                        onChange={(e) => updateStage(stage._key, "type", e.target.value)}
                        className={INPUT_CLASS}
                      >
                        {STAGE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Duration */}
                    <div>
                      <label htmlFor={`stg-dur-${stage._key}`} className={LABEL_CLASS}>
                        Duration (minutes) <span className="text-destructive">*</span>
                      </label>
                      <input
                        id={`stg-dur-${stage._key}`}
                        type="number"
                        min="1"
                        step="1"
                        placeholder="30"
                        value={stage.durationMinutes}
                        onChange={(e) => updateStage(stage._key, "durationMinutes", e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    {/* Requires oven */}
                    <div className="flex flex-col justify-end">
                      <div className="flex items-center gap-2 py-2.5">
                        <input
                          id={`stg-oven-${stage._key}`}
                          type="checkbox"
                          checked={stage.requiresOven}
                          onChange={(e) => updateStage(stage._key, "requiresOven", e.target.checked)}
                          className="rounded border-input w-4 h-4 accent-primary"
                        />
                        <label htmlFor={`stg-oven-${stage._key}`} className="flex items-center gap-1 text-sm cursor-pointer select-none">
                          <Flame className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                          Requires oven
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Oven temp — only shown when oven is ticked */}
                  {stage.requiresOven && (
                    <div className="max-w-[160px]">
                      <label htmlFor={`stg-temp-${stage._key}`} className={LABEL_CLASS}>
                        Oven temp (°C)
                      </label>
                      <input
                        id={`stg-temp-${stage._key}`}
                        type="number"
                        min="50"
                        max="350"
                        step="5"
                        placeholder="220"
                        value={stage.ovenTempCelsius}
                        onChange={(e) => updateStage(stage._key, "ovenTempCelsius", e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label htmlFor={`stg-notes-${stage._key}`} className={LABEL_CLASS}>
                      Notes <span className="text-[11px] text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <input
                      id={`stg-notes-${stage._key}`}
                      type="text"
                      placeholder="Any instructions for kitchen staff…"
                      value={stage.notes}
                      onChange={(e) => updateStage(stage._key, "notes", e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={addStage}
              className="w-full"
            >
              Add stage
            </Button>
          </fieldset>
        )}
      </div>

      {/* ── Footer actions ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-3 bg-card">
        <Button
          type="button"
          variant="ghost"
          onClick={step === 1 ? onCancel : goBack}
          leftIcon={step > 1 ? <ChevronLeft className="w-4 h-4" /> : undefined}
        >
          {step === 1 ? "Cancel" : "Back"}
        </Button>

        {step < 3 ? (
          <Button
            type="button"
            onClick={goNext}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Next: {stepLabels[step]}
          </Button>
        ) : (
          <Button
            type="button"
            loading={isPending}
            onClick={handleSubmit}
            leftIcon={<Check className="w-4 h-4" />}
          >
            {initialData ? "Save changes" : "Create recipe"}
          </Button>
        )}
      </div>
    </div>
  );
}
