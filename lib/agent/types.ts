/**
 * lib/agent/types.ts
 *
 * Internal types used exclusively by the BakeSync agent worker.
 * These are NOT the same as the public-facing API/domain types in /types —
 * they model the agent's reasoning context and structured outputs.
 */

// ─── Context fed INTO the LLM ────────────────────────────────────────────────

export interface AgentBakeryContext {
  bakeryId: string;
  bakeryName: string;
  timezone: string;
  targetDate: string;        // ISO date string "YYYY-MM-DD"
  shiftType: AgentShiftType;
  shiftWindow: {
    startTime: string;       // "HH:mm"
    endTime: string;         // "HH:mm"
  };
  ovenCount: number;         // total oven slots available
  pendingOrders: AgentOrder[];
  recipes: AgentRecipe[];
  stockLevels: AgentStockItem[];
  existingBatches: AgentExistingBatch[]; // batches already locked in for this day
}

export type AgentShiftType = "MORNING" | "AFTERNOON" | "EVENING" | "OVERNIGHT";

export interface AgentOrder {
  orderId: string;
  channel: string;
  customerName: string | null;
  fulfilmentDate: string;    // ISO
  lineItems: Array<{
    productName: string;
    quantity: number;
  }>;
}

export interface AgentRecipe {
  recipeId: string;
  name: string;
  category: string;
  yieldQuantity: number;
  yieldUnit: string;
  shelfLifeHours: number;
  wastageBufferPercent: number;
  totalElapsedMinutes: number;  // wall-clock time from start to end
  requiresOven: boolean;
  ovenMinutes: number;          // total minutes that need oven slots
  stages: Array<{
    order: number;
    type: string;
    name: string;
    durationMinutes: number;
    requiresOven: boolean;
    ovenTempCelsius: number | null;
  }>;
  ingredients: Array<{
    ingredientId: string;
    name: string;
    quantityGrams: number;       // per base recipe yield
  }>;
}

export interface AgentStockItem {
  ingredientId: string;
  name: string;
  stockGrams: number;
  reorderThresholdGrams: number;
  criticalThresholdGrams: number;
  alertLevel: string;
  expiryAlerts: Array<{
    lotCode: string | null;
    quantityGrams: number;
    expiresIn: string;           // human readable e.g. "2 days"
  }>;
}

export interface AgentExistingBatch {
  recipeId: string;
  recipeName: string;
  quantity: number;
  plannedStartTime: string;    // ISO
  plannedEndTime: string;      // ISO
  ovenSlots: number;
}

// ─── Structured output FROM the LLM ──────────────────────────────────────────

export interface AgentSchedulePlan {
  batches: AgentPlannedBatch[];
  warnings: string[];           // non-blocking notes from the AI
  aiNotes: string;              // human-readable reasoning summary
  ovenUtilizationPercent: number;
}

export interface AgentPlannedBatch {
  recipeId: string;
  recipeName: string;
  quantity: number;
  scaleFactor: number;
  plannedStartTime: string;     // ISO datetime
  plannedEndTime: string;       // ISO datetime
  ovenSlots: number;
  checklistSteps: Array<{
    description: string;
    deductions: Array<{ ingredientId: string; grams: number }>;
  }>;
  ingredientRequirements: Array<{
    ingredientId: string;
    name: string;
    requiredGrams: number;
    availableGrams: number;
    shortfallGrams: number;     // 0 if no shortfall
  }>;
}

// ─── Agent run result ────────────────────────────────────────────────────────

export interface AgentRunResult {
  success: boolean;
  scheduleId: string | null;
  shortfalls: Array<{
    ingredientId: string;
    ingredientName: string;
    shortfallGrams: number;
    urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }>;
  warnings: string[];
  aiNotes: string;
  processingMs: number;
  error?: string;
}
