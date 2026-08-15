export type RecipeCategory =
  | "BREAD"
  | "PASTRY"
  | "CAKE"
  | "BISCUIT"
  | "VIENNOISERIE"
  | "SAVOURY"
  | "OTHER";

export type RecipeStageType =
  | "MIX"
  | "AUTOLYSE"
  | "BULK_FERMENT"
  | "SHAPE"
  | "PROOF"
  | "RETARD"       // cold retard / overnight proof
  | "BAKE"
  | "COOL"
  | "FINISH"       // glazing, icing, decorating
  | "PACK";

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;     // in grams (always metric base unit)
  unit: string;         // display unit e.g. "g", "kg", "ml", "tsp"
  isOptional: boolean;
  notes: string | null;
}

export interface RecipeStage {
  id: string;
  recipeId: string;
  order: number;             // sequence index
  type: RecipeStageType;
  name: string;
  durationMinutes: number;
  requiresOven: boolean;
  ovenTempCelsius: number | null;
  notes: string | null;
}

export interface Recipe {
  id: string;
  bakeryId: string;
  name: string;
  category: RecipeCategory;
  description: string | null;
  yieldQuantity: number;      // how many units this recipe produces
  yieldUnit: string;          // e.g. "loaves", "rolls", "pieces"
  batchSizeMultiplier: number; // standard batch scale factor
  wastageBufferPercent: number; // empirical waste buffer e.g. 3 = 3%
  shelfLifeHours: number;     // how long finished product stays fresh
  isActive: boolean;
  ingredients: RecipeIngredient[];
  stages: RecipeStage[];
  totalActiveMins: number;    // sum of active (non-passive) stage durations
  totalElapsedMins: number;   // wall-clock time from start to end
  createdAt: Date;
  updatedAt: Date;
}

export type CreateRecipeInput = Omit<
  Recipe,
  "id" | "bakeryId" | "createdAt" | "updatedAt" | "totalActiveMins" | "totalElapsedMins"
>;

export type UpdateRecipeInput = Partial<CreateRecipeInput>;
