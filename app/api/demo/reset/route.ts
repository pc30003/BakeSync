/**
 * POST /api/demo/reset
 *
 * Resets the demo database back to its seeded state.
 * Only runs in demo mode. Protected by CRON_SECRET.
 * Called daily by Vercel cron to keep demo data fresh.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, error } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";
import {
  UserRole,
  RecipeCategory,
  RecipeStageType,
  IngredientCategory,
  OrderChannel,
  OrderStatus,
  ShiftType,
} from "@prisma/client";

const IS_DEMO = process.env.NEXT_PUBLIC_APP_MODE === "demo";

export async function POST(req: NextRequest) {
  if (!IS_DEMO) {
    return error("Not available in production mode", 403);
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return error("Unauthorized", 401);
  }

  try {
    // ── Wipe existing demo data ──────────────────────────────────────────
    await db.checklistItem.deleteMany({        where: { batch: { schedule: { bakeryId: "bakery_demo" } } } });
    await db.productionBatch.deleteMany({      where: { schedule: { bakeryId: "bakery_demo" } } });
    await db.productionSchedule.deleteMany({   where: { bakeryId: "bakery_demo" } });
    await db.agentAlert.deleteMany({           where: { bakeryId: "bakery_demo" } });
    await db.agentAction.deleteMany({          where: { bakeryId: "bakery_demo" } });
    await db.taskQueue.deleteMany({            where: { bakeryId: "bakery_demo" } });
    await db.procurementRecommendation.deleteMany({ where: { bakeryId: "bakery_demo" } });
    await db.wastageLog.deleteMany({           where: { bakeryId: "bakery_demo" } });
    await db.stockDeduction.deleteMany({       where: { bakeryId: "bakery_demo" } });
    await db.ingredientLot.deleteMany({        where: { ingredient: { bakeryId: "bakery_demo" } } });
    await db.orderLineItem.deleteMany({        where: { order: { bakeryId: "bakery_demo" } } });
    await db.order.deleteMany({                where: { bakeryId: "bakery_demo" } });
    await db.recipeIngredient.deleteMany({     where: { recipe: { bakeryId: "bakery_demo" } } });
    await db.recipeStage.deleteMany({          where: { recipe: { bakeryId: "bakery_demo" } } });
    await db.recipe.deleteMany({               where: { bakeryId: "bakery_demo" } });
    await db.ingredient.deleteMany({           where: { bakeryId: "bakery_demo" } });
    await db.supplier.deleteMany({             where: { bakeryId: "bakery_demo" } });
    await db.user.deleteMany({                 where: { bakeryId: "bakery_demo" } });
    await db.bakery.deleteMany({               where: { id: "bakery_demo" } });

    // ── Re-seed ──────────────────────────────────────────────────────────
    const demoPassword = await bcrypt.hash("demo1234", 10);

    const bakery = await db.bakery.create({
      data: {
        id:          "bakery_demo",
        name:        "The Artisan Loaf",
        timezone:    "Europe/London",
        openingTime: "05:30",
        closingTime: "18:00",
        currency:    "USD",
        isOnboarded: true,
        ovenCount:   2,
      },
    });

    const headBaker = await db.user.create({
      data: { email: "head@artisanloaf.com", name: "Sarah Chen", role: UserRole.HEAD_BAKER, password: demoPassword, bakeryId: bakery.id },
    });
    const floorStaff = await db.user.create({
      data: { email: "floor@artisanloaf.com", name: "Marcus Webb", role: UserRole.FLOOR_STAFF, password: demoPassword, bakeryId: bakery.id },
    });
    await db.user.create({
      data: { email: "purchasing@artisanloaf.com", name: "Priya Patel", role: UserRole.PURCHASING_MANAGER, password: demoPassword, bakeryId: bakery.id },
    });

    // Suppliers
    const flourSupplier = await db.supplier.create({
      data: { bakeryId: bakery.id, name: "Shipton Mill", contactEmail: "orders@shiptonmill.com", contactPhone: "+44 1453 800123", leadTimeDays: 2, isActive: true },
    });
    const dairySupplier = await db.supplier.create({
      data: { bakeryId: bakery.id, name: "County Dairy Direct", contactEmail: "supply@countydairy.co.uk", leadTimeDays: 1, isActive: true },
    });

    // Ingredients
    const strongFlour = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Strong White Bread Flour", category: IngredientCategory.FLOUR, unit: "kg", stockGrams: 25000, reorderThresholdGrams: 10000, criticalThresholdGrams: 3000, costPerKg: 0.85, supplierId: flourSupplier.id, alertLevel: "OK" },
    });
    const wholeMealFlour = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Wholemeal Flour", category: IngredientCategory.FLOUR, unit: "kg", stockGrams: 8000, reorderThresholdGrams: 5000, criticalThresholdGrams: 1500, costPerKg: 1.10, supplierId: flourSupplier.id, alertLevel: "LOW" },
    });
    const butter = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Unsalted Butter", category: IngredientCategory.FAT, unit: "kg", stockGrams: 5000, reorderThresholdGrams: 2000, criticalThresholdGrams: 500, costPerKg: 6.50, supplierId: dairySupplier.id, alertLevel: "OK" },
    });
    const instantYeast = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Instant Dried Yeast", category: IngredientCategory.LEAVENING, unit: "g", stockGrams: 2000, reorderThresholdGrams: 500, criticalThresholdGrams: 100, costPerKg: 12.00, alertLevel: "OK" },
    });
    const salt = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Fine Sea Salt", category: IngredientCategory.SALT, unit: "g", stockGrams: 5000, reorderThresholdGrams: 1000, criticalThresholdGrams: 200, costPerKg: 1.20, alertLevel: "OK" },
    });
    const eggs = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Free Range Eggs (Large)", category: IngredientCategory.EGG, unit: "units", stockGrams: 3600, reorderThresholdGrams: 1200, criticalThresholdGrams: 300, costPerKg: 3.20, supplierId: dairySupplier.id, alertLevel: "OK" },
    });

    // Recipes
    const sourdoughRecipe = await db.recipe.create({
      data: {
        bakeryId: bakery.id, name: "Classic Sourdough Loaf", category: RecipeCategory.BREAD,
        description: "Traditional long-ferment sourdough with a crisp crust and open crumb.",
        yieldQuantity: 2, yieldUnit: "loaves", batchSizeMultiplier: 1, wastageBufferPercent: 3, shelfLifeHours: 48, isActive: true,
        ingredients: { create: [
          { ingredientId: strongFlour.id, quantityGrams: 900, displayUnit: "g" },
          { ingredientId: salt.id, quantityGrams: 18, displayUnit: "g" },
        ]},
        stages: { create: [
          { order: 1, type: RecipeStageType.MIX, name: "Mix dough", durationMinutes: 20, requiresOven: false },
          { order: 2, type: RecipeStageType.AUTOLYSE, name: "Autolyse rest", durationMinutes: 30, requiresOven: false },
          { order: 3, type: RecipeStageType.BULK_FERMENT, name: "Bulk fermentation", durationMinutes: 240, requiresOven: false },
          { order: 4, type: RecipeStageType.SHAPE, name: "Shape loaves", durationMinutes: 20, requiresOven: false },
          { order: 5, type: RecipeStageType.RETARD, name: "Overnight retard", durationMinutes: 720, requiresOven: false },
          { order: 6, type: RecipeStageType.BAKE, name: "Bake in dutch oven", durationMinutes: 45, requiresOven: true, ovenTempCelsius: 250 },
          { order: 7, type: RecipeStageType.COOL, name: "Cool on rack", durationMinutes: 60, requiresOven: false },
        ]},
      },
    });

    const croissantRecipe = await db.recipe.create({
      data: {
        bakeryId: bakery.id, name: "Butter Croissant", category: RecipeCategory.VIENNOISERIE,
        description: "Classic laminated pastry with 27 layers of butter.",
        yieldQuantity: 12, yieldUnit: "croissants", batchSizeMultiplier: 1, wastageBufferPercent: 5, shelfLifeHours: 12, isActive: true,
        ingredients: { create: [
          { ingredientId: strongFlour.id, quantityGrams: 500, displayUnit: "g" },
          { ingredientId: butter.id, quantityGrams: 280, displayUnit: "g" },
          { ingredientId: instantYeast.id, quantityGrams: 10, displayUnit: "g" },
          { ingredientId: salt.id, quantityGrams: 10, displayUnit: "g" },
          { ingredientId: eggs.id, quantityGrams: 55, displayUnit: "g" },
        ]},
        stages: { create: [
          { order: 1, type: RecipeStageType.MIX, name: "Make détrempe", durationMinutes: 15, requiresOven: false },
          { order: 2, type: RecipeStageType.RETARD, name: "Chill dough", durationMinutes: 60, requiresOven: false },
          { order: 3, type: RecipeStageType.SHAPE, name: "Laminate & fold", durationMinutes: 45, requiresOven: false },
          { order: 4, type: RecipeStageType.RETARD, name: "Rest between folds", durationMinutes: 30, requiresOven: false },
          { order: 5, type: RecipeStageType.SHAPE, name: "Cut & shape", durationMinutes: 20, requiresOven: false },
          { order: 6, type: RecipeStageType.PROOF, name: "Final proof", durationMinutes: 120, requiresOven: false },
          { order: 7, type: RecipeStageType.BAKE, name: "Bake", durationMinutes: 18, requiresOven: true, ovenTempCelsius: 190 },
          { order: 8, type: RecipeStageType.COOL, name: "Cool", durationMinutes: 20, requiresOven: false },
        ]},
      },
    });

    // Orders
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    await db.order.create({
      data: {
        bakeryId: bakery.id, channel: OrderChannel.WHOLESALE, status: OrderStatus.CONFIRMED,
        customerName: "Bloom & Bean Café", customerEmail: "orders@bloomandbean.com",
        fulfilmentDate: tomorrow, totalValue: 148.50, notes: "Weekly standing order — delivery by 07:30",
        lineItems: { create: [
          { productId: "prod_sourdough", productName: "Classic Sourdough Loaf", quantity: 12, unitPrice: 7.50 },
          { productId: "prod_croissant", productName: "Butter Croissant", quantity: 24, unitPrice: 2.25 },
        ]},
      },
    });

    await db.order.create({
      data: {
        bakeryId: bakery.id, channel: OrderChannel.ECOMMERCE, status: OrderStatus.PENDING,
        customerName: "James Harrington", customerEmail: "jharrington@email.com",
        fulfilmentDate: tomorrow, totalValue: 22.00,
        lineItems: { create: [
          { productId: "prod_sourdough", productName: "Classic Sourdough Loaf", quantity: 2, unitPrice: 7.50 },
          { productId: "prod_croissant", productName: "Butter Croissant", quantity: 3, unitPrice: 2.25 },
        ]},
      },
    });

    // Agent Alert
    await db.agentAlert.create({
      data: {
        bakeryId: bakery.id, type: "SHORTFALL", severity: "WARNING",
        title: "Wholemeal Flour running low",
        message: "Current stock (8 kg) will not cover tomorrow's scheduled production. Recommended order: 15 kg from Shipton Mill.",
        relatedEntityId: wholeMealFlour.id, relatedEntityType: "Ingredient",
      },
    });

    // Production Schedule (today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const schedule = await db.productionSchedule.create({
      data: {
        bakeryId: bakery.id, scheduleDate: today, shiftType: ShiftType.MORNING,
        isAutoGenerated: true, isApproved: true, approvedById: headBaker.id, approvedAt: new Date(),
        totalOvenUtilizationPercent: 75,
        aiNotes: "Scheduled 2 sourdough batches and 1 croissant batch to fulfil tomorrow's orders. Oven utilisation at 75% — one slot reserved for ad-hoc bakes.",
      },
    });

    const sourdoughBatch = await db.productionBatch.create({
      data: {
        scheduleId: schedule.id, recipeId: sourdoughRecipe.id, shiftType: ShiftType.MORNING,
        status: "IN_PROGRESS", quantity: 8, scaleFactor: 4,
        plannedStartTime: new Date(today.getTime() + 5.5 * 60 * 60 * 1000),
        plannedEndTime: new Date(today.getTime() + 12 * 60 * 60 * 1000),
        ovenSlots: 2, notes: "4x batch for café wholesale order",
      },
    });

    const croissantBatch = await db.productionBatch.create({
      data: {
        scheduleId: schedule.id, recipeId: croissantRecipe.id, shiftType: ShiftType.MORNING,
        status: "SCHEDULED", quantity: 24, scaleFactor: 2,
        plannedStartTime: new Date(today.getTime() + 6 * 60 * 60 * 1000),
        plannedEndTime: new Date(today.getTime() + 11 * 60 * 60 * 1000),
        ovenSlots: 1, notes: "Double batch — 24 croissants for retail + café",
      },
    });

    // Checklists
    await db.checklistItem.createMany({
      data: [
        { batchId: sourdoughBatch.id, order: 1, description: "Weigh 3.6 kg bread flour into mixing bowl", status: "DONE", completedById: floorStaff.id, completedAt: new Date() },
        { batchId: sourdoughBatch.id, order: 2, description: "Add 72g sea salt and 2.4L water", status: "DONE", completedById: floorStaff.id, completedAt: new Date() },
        { batchId: sourdoughBatch.id, order: 3, description: "Mix on low speed for 10 minutes", status: "DONE", completedById: floorStaff.id, completedAt: new Date() },
        { batchId: sourdoughBatch.id, order: 4, description: "Autolyse rest — cover and leave 30 min", status: "IN_PROGRESS" },
        { batchId: sourdoughBatch.id, order: 5, description: "Bulk ferment at 25°C for 4 hours (stretch & fold every 45 min)", status: "PENDING" },
        { batchId: sourdoughBatch.id, order: 6, description: "Divide into 8 pieces, pre-shape rounds", status: "PENDING" },
        { batchId: sourdoughBatch.id, order: 7, description: "Final shape into bannetons", status: "PENDING" },
        { batchId: sourdoughBatch.id, order: 8, description: "Bake at 250°C with steam — 25 min lid on, 20 min lid off", status: "PENDING" },
        { batchId: sourdoughBatch.id, order: 9, description: "Cool on wire rack for 60 minutes before slicing", status: "PENDING" },
      ],
    });

    await db.checklistItem.createMany({
      data: [
        { batchId: croissantBatch.id, order: 1, description: "Weigh 1 kg flour, 20g yeast, 20g salt, 110g eggs", status: "PENDING" },
        { batchId: croissantBatch.id, order: 2, description: "Mix détrempe — 15 min on medium speed", status: "PENDING" },
        { batchId: croissantBatch.id, order: 3, description: "Chill détrempe 1 hour", status: "PENDING" },
        { batchId: croissantBatch.id, order: 4, description: "Prepare 560g butter block", status: "PENDING" },
        { batchId: croissantBatch.id, order: 5, description: "First lamination fold (letter fold)", status: "PENDING" },
        { batchId: croissantBatch.id, order: 6, description: "Rest 30 min, second fold, rest 30 min, third fold", status: "PENDING" },
        { batchId: croissantBatch.id, order: 7, description: "Roll out to 4mm, cut 24 triangles", status: "PENDING" },
        { batchId: croissantBatch.id, order: 8, description: "Shape croissants, egg wash", status: "PENDING" },
        { batchId: croissantBatch.id, order: 9, description: "Proof at 27°C for 2 hours until doubled", status: "PENDING" },
        { batchId: croissantBatch.id, order: 10, description: "Bake at 190°C for 18 minutes until golden", status: "PENDING" },
        { batchId: croissantBatch.id, order: 11, description: "Cool on rack — do not stack", status: "PENDING" },
      ],
    });

    // Procurement Recommendations
    await db.procurementRecommendation.createMany({
      data: [
        {
          bakeryId: bakery.id, ingredientId: wholeMealFlour.id,
          currentStockGrams: 8000, requiredGrams: 15000, shortfallGrams: 7000, recommendedOrderGrams: 15000,
          supplierId: flourSupplier.id, estimatedCost: 16.50, urgency: "HIGH",
        },
        {
          bakeryId: bakery.id, ingredientId: eggs.id,
          currentStockGrams: 3600, requiredGrams: 6000, shortfallGrams: 2400, recommendedOrderGrams: 5000,
          supplierId: dairySupplier.id, estimatedCost: 16.00, urgency: "MEDIUM",
        },
      ],
    });

    return ok({ message: "Demo data reset successfully", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[Demo Reset]", err);
    const message = err instanceof Error ? err.message : "Reset failed";
    return error(message, 500);
  }
}
