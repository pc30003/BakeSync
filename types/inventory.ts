export type IngredientCategory =
  | "FLOUR"
  | "GRAIN"
  | "DAIRY"
  | "FAT"
  | "SWEETENER"
  | "LEAVENING"
  | "EGG"
  | "FRUIT"
  | "NUT"
  | "CHOCOLATE"
  | "SPICE"
  | "SALT"
  | "LIQUID"
  | "PACKAGING"
  | "OTHER";

export type StockAlertLevel = "OK" | "LOW" | "CRITICAL" | "OUT_OF_STOCK";

export interface Supplier {
  id: string;
  bakeryId: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  leadTimeDays: number;     // typical delivery lead time
  notes: string | null;
  isActive: boolean;
}

export interface IngredientLot {
  id: string;
  ingredientId: string;
  supplierId: string | null;
  lotCode: string | null;
  quantityGrams: number;
  expiryDate: Date | null;
  receivedAt: Date;
  costPerKg: number;
}

export interface Ingredient {
  id: string;
  bakeryId: string;
  name: string;
  category: IngredientCategory;
  unit: string;              // canonical display unit
  stockGrams: number;        // total on-hand in grams
  reorderThresholdGrams: number;
  criticalThresholdGrams: number;
  costPerKg: number;         // latest cost per kg
  supplierId: string | null;
  supplier: Supplier | null;
  lots: IngredientLot[];
  alertLevel: StockAlertLevel;
  isTracked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockDeduction {
  id: string;
  bakeryId: string;
  ingredientId: string;
  ingredientName: string;
  quantityGrams: number;
  reason: "PRODUCTION" | "WASTAGE" | "SPOILAGE" | "ADJUSTMENT" | "STOCKTAKE";
  referenceId: string | null;   // e.g. productionBatchId
  loggedBy: string;             // userId
  loggedAt: Date;
}

export interface ProcurementRecommendation {
  id: string;
  bakeryId: string;
  ingredientId: string;
  ingredientName: string;
  currentStockGrams: number;
  requiredGrams: number;
  shortfallGrams: number;
  recommendedOrderGrams: number;
  supplierId: string | null;
  supplierName: string | null;
  estimatedCost: number | null;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  generatedAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
}

export interface WastageLog {
  id: string;
  bakeryId: string;
  ingredientId: string | null;
  ingredientName: string | null;
  productId: string | null;
  productName: string | null;
  quantityGrams: number;
  reason: string;
  loggedBy: string;
  shiftDate: Date;
  createdAt: Date;
}
