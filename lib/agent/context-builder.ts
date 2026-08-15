/**
 * lib/agent/context-builder.ts
 *
 * Queries the database to build the full AgentBakeryContext that gets
 * passed to the LLM planner. Keeps all DB logic out of the planner.
 */

import { db } from "@/lib/db";
import { addDays, differenceInDays, format, startOfDay, endOfDay } from "date-fns";
import type { AgentBakeryContext, AgentShiftType } from "./types";

const SHIFT_WINDOWS: Record<AgentShiftType, { startTime: string; endTime: string }> = {
  MORNING:   { startTime: "04:00", endTime: "12:00" },
  AFTERNOON: { startTime: "12:00", endTime: "18:00" },
  EVENING:   { startTime: "18:00", endTime: "23:00" },
  OVERNIGHT: { startTime: "22:00", endTime: "06:00" },
};

// DEFAULT_OVEN_COUNT used as fallback if bakery ovenCount is not set
const DEFAULT_OVEN_COUNT = 2;

export async function buildAgentContext(
  bakeryId: string,
  targetDate: Date,
  shiftType: AgentShiftType
): Promise<AgentBakeryContext> {
  const dateStr = format(targetDate, "yyyy-MM-dd");
  const window  = SHIFT_WINDOWS[shiftType];

  // Run all DB queries in parallel
  const [bakery, orders, recipes, ingredients, existingSchedule] = await Promise.all([
    // Bakery info — select ovenCount so the agent respects the bakery's physical setup
    db.bakery.findUniqueOrThrow({ where: { id: bakeryId }, select: { id: true, name: true, timezone: true, ovenCount: true } }),

    // Orders due on target date (or within 2 days to account for pre-baking)
    db.order.findMany({
      where: {
        bakeryId,
        status: { in: ["PENDING", "CONFIRMED"] },
        fulfilmentDate: {
          gte: startOfDay(targetDate),
          lte: endOfDay(addDays(targetDate, 1)),
        },
      },
      include: { lineItems: true },
    }),

    // All active recipes with their stages and ingredients
    db.recipe.findMany({
      where: { bakeryId, isActive: true },
      include: {
        stages:      { orderBy: { order: "asc" } },
        ingredients: { include: { ingredient: { select: { id: true, name: true } } } },
      },
    }),

    // All tracked ingredients with FEFO lots
    db.ingredient.findMany({
      where: { bakeryId, isTracked: true },
      include: {
        lots: {
          orderBy: { expiryDate: "asc" },
          where:   { quantityGrams: { gt: 0 } },
        },
      },
    }),

    // Any batches already scheduled for this date/shift
    db.productionSchedule.findFirst({
      where: {
        bakeryId,
        scheduleDate: targetDate,
        shiftType,
      },
      include: {
        batches: {
          include: { recipe: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  // ── Map recipes ─────────────────────────────────────────────────────────────
  const agentRecipes = recipes.map((r) => {
    const totalElapsed = r.stages.reduce((sum, s) => sum + s.durationMinutes, 0);
    const ovenMinutes  = r.stages
      .filter((s) => s.requiresOven)
      .reduce((sum, s) => sum + s.durationMinutes, 0);

    return {
      recipeId:              r.id,
      name:                  r.name,
      category:              r.category,
      yieldQuantity:         r.yieldQuantity,
      yieldUnit:             r.yieldUnit,
      shelfLifeHours:        r.shelfLifeHours,
      wastageBufferPercent:  Number(r.wastageBufferPercent),
      totalElapsedMinutes:   totalElapsed,
      requiresOven:          r.stages.some((s) => s.requiresOven),
      ovenMinutes,
      stages: r.stages.map((s) => ({
        order:           s.order,
        type:            s.type,
        name:            s.name,
        durationMinutes: s.durationMinutes,
        requiresOven:    s.requiresOven,
        ovenTempCelsius: s.ovenTempCelsius,
      })),
      ingredients: r.ingredients.map((ri) => ({
        ingredientId:  ri.ingredientId,
        name:          ri.ingredient.name,
        quantityGrams: Number(ri.quantityGrams),
      })),
    };
  });

  // ── Map stock levels ─────────────────────────────────────────────────────────
  const now = new Date();
  const agentStock = ingredients.map((ing) => {
    const expiryAlerts = ing.lots
      .filter((lot) => lot.expiryDate !== null)
      .map((lot) => {
        const daysUntil = differenceInDays(lot.expiryDate!, now);
        return {
          lotCode:      lot.lotCode,
          quantityGrams: Number(lot.quantityGrams),
          expiresIn:    daysUntil <= 0
            ? "expired"
            : daysUntil === 1
              ? "1 day"
              : `${daysUntil} days`,
        };
      })
      .filter((a) => {
        // Only surface expiry alerts for lots expiring within 3 days
        const days = parseInt(a.expiresIn);
        return a.expiresIn === "expired" || (!isNaN(days) && days <= 3);
      });

    return {
      ingredientId:          ing.id,
      name:                  ing.name,
      stockGrams:            Number(ing.stockGrams),
      reorderThresholdGrams: Number(ing.reorderThresholdGrams),
      criticalThresholdGrams: Number(ing.criticalThresholdGrams),
      alertLevel:            ing.alertLevel,
      expiryAlerts,
    };
  });

  // ── Map existing batches ─────────────────────────────────────────────────────
  const agentExisting = (existingSchedule?.batches ?? []).map((b) => ({
    recipeId:        b.recipeId,
    recipeName:      b.recipe.name,
    quantity:        b.quantity,
    plannedStartTime: b.plannedStartTime.toISOString(),
    plannedEndTime:   b.plannedEndTime.toISOString(),
    ovenSlots:       b.ovenSlots,
  }));

  // ── Map orders ───────────────────────────────────────────────────────────────
  const agentOrders = orders.map((o) => ({
    orderId:        o.id,
    channel:        o.channel,
    customerName:   o.customerName,
    fulfilmentDate: o.fulfilmentDate.toISOString(),
    lineItems:      o.lineItems.map((li) => ({
      productName: li.productName,
      quantity:    li.quantity,
    })),
  }));

  return {
    bakeryId,
    bakeryName:   bakery.name,
    timezone:     bakery.timezone,
    targetDate:   dateStr,
    shiftType,
    shiftWindow:  window,
    ovenCount:    bakery.ovenCount ?? DEFAULT_OVEN_COUNT,
    pendingOrders: agentOrders,
    recipes:       agentRecipes,
    stockLevels:   agentStock,
    existingBatches: agentExisting,
  };
}
