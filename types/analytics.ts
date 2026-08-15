export interface DailyProductionSummary {
  date: Date;
  totalBatches: number;
  completedBatches: number;
  totalUnitsProduced: number;
  ovenUtilizationPercent: number;
  wastageGrams: number;
  wasteValueEstimate: number;
}

export interface IngredientUsageTrend {
  ingredientId: string;
  ingredientName: string;
  usageByDay: Array<{ date: Date; grams: number }>;
  averageDailyGrams: number;
  forecastedDailyGrams: number;
}

export interface DemandForecast {
  productId: string;
  productName: string;
  forecastDate: Date;
  predictedQuantity: number;
  confidencePercent: number;
  factors: string[];   // e.g. ["weekend_uplift", "weather_sunny", "local_event"]
}

export interface WasteReport {
  period: { from: Date; to: Date };
  totalWastageGrams: number;
  totalWasteValue: number;
  wasteByCategory: Array<{ category: string; grams: number; value: number }>;
  topWastedIngredients: Array<{
    ingredientId: string;
    name: string;
    grams: number;
  }>;
  wastageBufferAccuracy: number;  // % difference between estimated and actual waste
}

export interface KpiSnapshot {
  date: Date;
  ovenUtilization: number;
  wastePercent: number;
  onTimeProductionPercent: number;
  stockOutEvents: number;
  pendingProcurementItems: number;
  activeOrders: number;
}
