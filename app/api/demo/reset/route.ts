/**
 * POST /api/demo/reset
 *
 * Resets the demo database back to its seeded state.
 * Only runs in demo mode. Protected by CRON_SECRET.
 * Called daily by Vercel cron to keep demo data fresh.
 *
 * IMPORTANT: Keep this in sync with prisma/seed.ts
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
    // ── Wipe ALL existing demo data ──────────────────────────────────────
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

    // ── Re-seed (mirrors prisma/seed.ts exactly) ─────────────────────────
    const demoPassword = await bcrypt.hash("demo1234", 10);

    const bakery = await db.bakery.create({
      data: {
        id: "bakery_demo", name: "The Artisan Loaf", timezone: "Europe/London",
        openingTime: "05:30", closingTime: "18:00", currency: "USD",
        ovenCount: 3, isOnboarded: true,
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
      data: { bakeryId: bakery.id, name: "Shipton Mill", contactEmail: "orders@shiptonmill.com", contactPhone: "+44 1453 800123", leadTimeDays: 2, isActive: true, notes: "Organic & heritage flours. Minimum order 25kg." },
    });
    const dairySupplier = await db.supplier.create({
      data: { bakeryId: bakery.id, name: "County Dairy Direct", contactEmail: "supply@countydairy.co.uk", contactPhone: "+44 1234 567890", leadTimeDays: 1, isActive: true, notes: "Next-day delivery for butter, cream, milk." },
    });
    const eggSupplier = await db.supplier.create({
      data: { bakeryId: bakery.id, name: "Cotswold Free Range", contactEmail: "sales@cotswoldeggs.co.uk", contactPhone: "+44 1285 654321", leadTimeDays: 1, isActive: true, notes: "Free range eggs, delivered in trays of 30." },
    });
    const chocolateSupplier = await db.supplier.create({
      data: { bakeryId: bakery.id, name: "Callebaut UK", contactEmail: "orders@callebaut.co.uk", contactPhone: "+44 20 7946 0958", leadTimeDays: 3, isActive: true, notes: "Belgian couverture chocolate. Min order £50." },
    });
    await db.supplier.create({
      data: { bakeryId: bakery.id, name: "BakePack Solutions", contactEmail: "hello@bakepack.co.uk", contactPhone: "+44 161 555 0199", leadTimeDays: 5, isActive: true, notes: "Eco-friendly boxes, bags, and labels." },
    });
    const fruitSupplier = await db.supplier.create({
      data: { bakeryId: bakery.id, name: "Orchard Fresh", contactEmail: "wholesale@orchardfresh.co.uk", contactPhone: "+44 1234 111222", leadTimeDays: 2, isActive: true, notes: "Seasonal fruit, berries, and citrus zest." },
    });

    // Ingredients
    const strongFlour = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Strong White Bread Flour", category: IngredientCategory.FLOUR, unit: "kg", stockGrams: 45000, reorderThresholdGrams: 15000, criticalThresholdGrams: 5000, costPerKg: 0.85, supplierId: flourSupplier.id, alertLevel: "OK" },
    });
    const wholeMealFlour = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Wholemeal Flour", category: IngredientCategory.FLOUR, unit: "kg", stockGrams: 8000, reorderThresholdGrams: 10000, criticalThresholdGrams: 3000, costPerKg: 1.10, supplierId: flourSupplier.id, alertLevel: "LOW" },
    });
    await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Dark Rye Flour", category: IngredientCategory.FLOUR, unit: "kg", stockGrams: 6000, reorderThresholdGrams: 4000, criticalThresholdGrams: 1500, costPerKg: 1.40, supplierId: flourSupplier.id, alertLevel: "OK" },
    });
    const butter = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Unsalted Butter (82% fat)", category: IngredientCategory.FAT, unit: "kg", stockGrams: 12000, reorderThresholdGrams: 5000, criticalThresholdGrams: 2000, costPerKg: 6.50, supplierId: dairySupplier.id, alertLevel: "OK" },
    });
    const wholeMilk = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Whole Milk", category: IngredientCategory.LIQUID, unit: "L", stockGrams: 15000, reorderThresholdGrams: 8000, criticalThresholdGrams: 3000, costPerKg: 1.10, supplierId: dairySupplier.id, alertLevel: "OK" },
    });
    const doubleCream = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Double Cream", category: IngredientCategory.DAIRY, unit: "L", stockGrams: 4000, reorderThresholdGrams: 3000, criticalThresholdGrams: 1000, costPerKg: 3.80, supplierId: dairySupplier.id, alertLevel: "LOW" },
    });
    const eggs = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Free Range Eggs (Large)", category: IngredientCategory.EGG, unit: "units", stockGrams: 7200, reorderThresholdGrams: 3600, criticalThresholdGrams: 1200, costPerKg: 3.20, supplierId: eggSupplier.id, alertLevel: "OK" },
    });
    const instantYeast = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Instant Dried Yeast", category: IngredientCategory.LEAVENING, unit: "g", stockGrams: 3000, reorderThresholdGrams: 800, criticalThresholdGrams: 200, costPerKg: 12.00, alertLevel: "OK" },
    });
    const salt = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Fine Sea Salt", category: IngredientCategory.SALT, unit: "g", stockGrams: 8000, reorderThresholdGrams: 2000, criticalThresholdGrams: 500, costPerKg: 1.20, alertLevel: "OK" },
    });
    const casterSugar = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Caster Sugar", category: IngredientCategory.SWEETENER, unit: "kg", stockGrams: 10000, reorderThresholdGrams: 4000, criticalThresholdGrams: 1500, costPerKg: 0.95, alertLevel: "OK" },
    });
    const darkChocolate = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Dark Chocolate 70% (Callebaut)", category: IngredientCategory.CHOCOLATE, unit: "kg", stockGrams: 2500, reorderThresholdGrams: 3000, criticalThresholdGrams: 1000, costPerKg: 14.50, supplierId: chocolateSupplier.id, alertLevel: "LOW" },
    });
    const vanillaExtract = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Vanilla Extract (Madagascar)", category: IngredientCategory.SPICE, unit: "ml", stockGrams: 500, reorderThresholdGrams: 200, criticalThresholdGrams: 50, costPerKg: 85.00, alertLevel: "OK" },
    });
    const cinnamon = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Ground Cinnamon (Ceylon)", category: IngredientCategory.SPICE, unit: "g", stockGrams: 800, reorderThresholdGrams: 300, criticalThresholdGrams: 100, costPerKg: 22.00, alertLevel: "OK" },
    });
    const oliveOil = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Extra Virgin Olive Oil", category: IngredientCategory.FAT, unit: "L", stockGrams: 5000, reorderThresholdGrams: 2000, criticalThresholdGrams: 500, costPerKg: 8.50, alertLevel: "OK" },
    });
    const frozenRaspberries = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Frozen Raspberries", category: IngredientCategory.FRUIT, unit: "kg", stockGrams: 1500, reorderThresholdGrams: 2000, criticalThresholdGrams: 500, costPerKg: 9.00, supplierId: fruitSupplier.id, alertLevel: "LOW" },
    });
    await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Almond Flour (Ground)", category: IngredientCategory.NUT, unit: "kg", stockGrams: 3000, reorderThresholdGrams: 2000, criticalThresholdGrams: 800, costPerKg: 11.00, alertLevel: "OK" },
    });
    const cakeFlour = await db.ingredient.create({
      data: { bakeryId: bakery.id, name: "Cake Flour (Low Protein)", category: IngredientCategory.FLOUR, unit: "kg", stockGrams: 8000, reorderThresholdGrams: 4000, criticalThresholdGrams: 1500, costPerKg: 1.20, supplierId: flourSupplier.id, alertLevel: "OK" },
    });

    // Recipes
    const sourdoughRecipe = await db.recipe.create({
      data: {
        bakeryId: bakery.id, name: "Classic Sourdough Loaf", category: RecipeCategory.BREAD,
        description: "Traditional long-ferment sourdough with a crisp crust and open crumb. Our signature bestseller.",
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
        description: "Classic laminated pastry with 27 layers of butter. Light, flaky, and golden.",
        yieldQuantity: 12, yieldUnit: "croissants", batchSizeMultiplier: 1, wastageBufferPercent: 5, shelfLifeHours: 12, isActive: true,
        ingredients: { create: [
          { ingredientId: strongFlour.id, quantityGrams: 500, displayUnit: "g" },
          { ingredientId: butter.id, quantityGrams: 280, displayUnit: "g" },
          { ingredientId: instantYeast.id, quantityGrams: 10, displayUnit: "g" },
          { ingredientId: salt.id, quantityGrams: 10, displayUnit: "g" },
          { ingredientId: eggs.id, quantityGrams: 55, displayUnit: "g" },
          { ingredientId: wholeMilk.id, quantityGrams: 150, displayUnit: "ml" },
          { ingredientId: casterSugar.id, quantityGrams: 50, displayUnit: "g" },
        ]},
        stages: { create: [
          { order: 1, type: RecipeStageType.MIX, name: "Make détrempe", durationMinutes: 15, requiresOven: false },
          { order: 2, type: RecipeStageType.RETARD, name: "Chill dough", durationMinutes: 60, requiresOven: false },
          { order: 3, type: RecipeStageType.SHAPE, name: "Laminate & fold (3 turns)", durationMinutes: 45, requiresOven: false },
          { order: 4, type: RecipeStageType.RETARD, name: "Rest between folds", durationMinutes: 30, requiresOven: false },
          { order: 5, type: RecipeStageType.SHAPE, name: "Cut & shape croissants", durationMinutes: 20, requiresOven: false },
          { order: 6, type: RecipeStageType.PROOF, name: "Final proof at 27°C", durationMinutes: 120, requiresOven: false },
          { order: 7, type: RecipeStageType.BAKE, name: "Bake until golden", durationMinutes: 18, requiresOven: true, ovenTempCelsius: 190 },
          { order: 8, type: RecipeStageType.COOL, name: "Cool on rack", durationMinutes: 20, requiresOven: false },
        ]},
      },
    });

    await db.recipe.create({
      data: {
        bakeryId: bakery.id, name: "Cinnamon Swirl Rolls", category: RecipeCategory.VIENNOISERIE,
        description: "Soft enriched dough rolled with cinnamon sugar and topped with cream cheese glaze.",
        yieldQuantity: 12, yieldUnit: "rolls", batchSizeMultiplier: 1, wastageBufferPercent: 4, shelfLifeHours: 24, isActive: true,
        ingredients: { create: [
          { ingredientId: strongFlour.id, quantityGrams: 600, displayUnit: "g" },
          { ingredientId: butter.id, quantityGrams: 100, displayUnit: "g" },
          { ingredientId: casterSugar.id, quantityGrams: 120, displayUnit: "g" },
          { ingredientId: cinnamon.id, quantityGrams: 15, displayUnit: "g" },
          { ingredientId: eggs.id, quantityGrams: 110, displayUnit: "g" },
          { ingredientId: wholeMilk.id, quantityGrams: 200, displayUnit: "ml" },
          { ingredientId: instantYeast.id, quantityGrams: 8, displayUnit: "g" },
        ]},
        stages: { create: [
          { order: 1, type: RecipeStageType.MIX, name: "Mix enriched dough", durationMinutes: 15, requiresOven: false },
          { order: 2, type: RecipeStageType.BULK_FERMENT, name: "First rise", durationMinutes: 90, requiresOven: false },
          { order: 3, type: RecipeStageType.SHAPE, name: "Roll, fill, cut into 12 rolls", durationMinutes: 20, requiresOven: false },
          { order: 4, type: RecipeStageType.PROOF, name: "Second rise", durationMinutes: 45, requiresOven: false },
          { order: 5, type: RecipeStageType.BAKE, name: "Bake", durationMinutes: 22, requiresOven: true, ovenTempCelsius: 180 },
          { order: 6, type: RecipeStageType.COOL, name: "Cool and glaze", durationMinutes: 15, requiresOven: false },
        ]},
      },
    });

    const focaccia = await db.recipe.create({
      data: {
        bakeryId: bakery.id, name: "Rosemary Focaccia", category: RecipeCategory.BREAD,
        description: "High-hydration Italian flatbread with olive oil, sea salt, and fresh rosemary.",
        yieldQuantity: 1, yieldUnit: "tray (12 portions)", batchSizeMultiplier: 1, wastageBufferPercent: 3, shelfLifeHours: 24, isActive: true,
        ingredients: { create: [
          { ingredientId: strongFlour.id, quantityGrams: 500, displayUnit: "g" },
          { ingredientId: oliveOil.id, quantityGrams: 80, displayUnit: "ml" },
          { ingredientId: salt.id, quantityGrams: 12, displayUnit: "g" },
          { ingredientId: instantYeast.id, quantityGrams: 5, displayUnit: "g" },
        ]},
        stages: { create: [
          { order: 1, type: RecipeStageType.MIX, name: "Mix wet dough", durationMinutes: 10, requiresOven: false },
          { order: 2, type: RecipeStageType.BULK_FERMENT, name: "Bulk ferment with folds", durationMinutes: 180, requiresOven: false },
          { order: 3, type: RecipeStageType.SHAPE, name: "Oil pan, stretch dough, dimple", durationMinutes: 15, requiresOven: false },
          { order: 4, type: RecipeStageType.PROOF, name: "Final proof", durationMinutes: 30, requiresOven: false },
          { order: 5, type: RecipeStageType.BAKE, name: "Bake until golden", durationMinutes: 25, requiresOven: true, ovenTempCelsius: 220 },
          { order: 6, type: RecipeStageType.COOL, name: "Rest 5 min, slice", durationMinutes: 10, requiresOven: false },
        ]},
      },
    });

    await db.recipe.create({
      data: {
        bakeryId: bakery.id, name: "Dark Chocolate Brownies", category: RecipeCategory.CAKE,
        description: "Rich, fudgy brownies made with 70% Belgian chocolate. Cut into 16 squares.",
        yieldQuantity: 16, yieldUnit: "squares", batchSizeMultiplier: 1, wastageBufferPercent: 2, shelfLifeHours: 72, isActive: true,
        ingredients: { create: [
          { ingredientId: darkChocolate.id, quantityGrams: 300, displayUnit: "g" },
          { ingredientId: butter.id, quantityGrams: 250, displayUnit: "g" },
          { ingredientId: casterSugar.id, quantityGrams: 350, displayUnit: "g" },
          { ingredientId: eggs.id, quantityGrams: 220, displayUnit: "g" },
          { ingredientId: cakeFlour.id, quantityGrams: 130, displayUnit: "g" },
          { ingredientId: vanillaExtract.id, quantityGrams: 5, displayUnit: "ml" },
        ]},
        stages: { create: [
          { order: 1, type: RecipeStageType.MIX, name: "Melt chocolate & butter", durationMinutes: 10, requiresOven: false },
          { order: 2, type: RecipeStageType.MIX, name: "Whisk eggs, sugar, vanilla", durationMinutes: 5, requiresOven: false },
          { order: 3, type: RecipeStageType.MIX, name: "Fold together with flour", durationMinutes: 5, requiresOven: false },
          { order: 4, type: RecipeStageType.BAKE, name: "Bake (slightly underdone centre)", durationMinutes: 28, requiresOven: true, ovenTempCelsius: 170 },
          { order: 5, type: RecipeStageType.COOL, name: "Cool completely before cutting", durationMinutes: 60, requiresOven: false },
        ]},
      },
    });

    // Orders
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(9, 0, 0, 0);

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
        bakeryId: bakery.id, channel: OrderChannel.WHOLESALE, status: OrderStatus.CONFIRMED,
        customerName: "The Green Pantry", customerEmail: "kitchen@greenpantry.co.uk",
        fulfilmentDate: tomorrow, totalValue: 92.00, notes: "New weekly account — trial order",
        lineItems: { create: [
          { productId: "prod_focaccia", productName: "Rosemary Focaccia", quantity: 8, unitPrice: 4.50 },
          { productId: "prod_sourdough", productName: "Classic Sourdough Loaf", quantity: 6, unitPrice: 7.50 },
          { productId: "prod_brownie", productName: "Dark Chocolate Brownies (box of 4)", quantity: 3, unitPrice: 6.00 },
        ]},
      },
    });

    await db.order.create({
      data: {
        bakeryId: bakery.id, channel: OrderChannel.ECOMMERCE, status: OrderStatus.PENDING,
        customerName: "James Harrington", customerEmail: "jharrington@email.com",
        fulfilmentDate: tomorrow, totalValue: 32.50,
        lineItems: { create: [
          { productId: "prod_sourdough", productName: "Classic Sourdough Loaf", quantity: 2, unitPrice: 7.50 },
          { productId: "prod_cinnamon", productName: "Cinnamon Swirl Rolls (6 pack)", quantity: 1, unitPrice: 9.50 },
          { productId: "prod_brownie", productName: "Dark Chocolate Brownies (box of 4)", quantity: 1, unitPrice: 8.00 },
        ]},
      },
    });

    await db.order.create({
      data: {
        bakeryId: bakery.id, channel: OrderChannel.ECOMMERCE, status: OrderStatus.CONFIRMED,
        customerName: "Sophie Williams", customerEmail: "sophie.w@gmail.com",
        fulfilmentDate: tomorrow, totalValue: 27.00,
        lineItems: { create: [
          { productId: "prod_croissant", productName: "Butter Croissant", quantity: 6, unitPrice: 2.50 },
          { productId: "prod_cinnamon", productName: "Cinnamon Swirl Rolls (6 pack)", quantity: 1, unitPrice: 9.50 },
        ]},
      },
    });

    await db.order.create({
      data: {
        bakeryId: bakery.id, channel: OrderChannel.MANUAL, status: OrderStatus.CONFIRMED,
        customerName: "London Fields Hotel", customerEmail: "events@londonfieldshotel.co.uk",
        fulfilmentDate: dayAfter, totalValue: 285.00, notes: "Conference catering — 50 pax breakfast. Deliver by 7am.",
        lineItems: { create: [
          { productId: "prod_croissant", productName: "Butter Croissant", quantity: 50, unitPrice: 2.50 },
          { productId: "prod_cinnamon", productName: "Cinnamon Swirl Rolls", quantity: 30, unitPrice: 3.00 },
          { productId: "prod_brownie", productName: "Dark Chocolate Brownies", quantity: 25, unitPrice: 2.00 },
        ]},
      },
    });

    await db.order.create({
      data: {
        bakeryId: bakery.id, channel: OrderChannel.WHOLESALE, status: OrderStatus.CONFIRMED,
        customerName: "Riverside Deli", customerEmail: "orders@riversidedeli.co.uk",
        fulfilmentDate: dayAfter, totalValue: 67.50,
        lineItems: { create: [
          { productId: "prod_sourdough", productName: "Classic Sourdough Loaf", quantity: 4, unitPrice: 7.50 },
          { productId: "prod_focaccia", productName: "Rosemary Focaccia", quantity: 5, unitPrice: 4.50 },
          { productId: "prod_brownie", productName: "Dark Chocolate Brownies (box of 4)", quantity: 3, unitPrice: 6.00 },
        ]},
      },
    });

    await db.order.create({
      data: {
        bakeryId: bakery.id, channel: OrderChannel.ECOMMERCE, status: OrderStatus.PENDING,
        customerName: "David & Maria Chen", customerEmail: "david.chen@proton.me",
        fulfilmentDate: dayAfter, totalValue: 45.00, notes: "Birthday celebration — extra packaging please",
        lineItems: { create: [
          { productId: "prod_brownie", productName: "Dark Chocolate Brownies (box of 16)", quantity: 2, unitPrice: 16.00 },
          { productId: "prod_cinnamon", productName: "Cinnamon Swirl Rolls (12 pack)", quantity: 1, unitPrice: 13.00 },
        ]},
      },
    });

    await db.order.create({
      data: {
        bakeryId: bakery.id, channel: OrderChannel.POS, status: OrderStatus.IN_PRODUCTION,
        customerName: "Walk-in (counter)", customerEmail: null,
        fulfilmentDate: new Date(), totalValue: 18.50, notes: "Collected at counter",
        lineItems: { create: [
          { productId: "prod_sourdough", productName: "Classic Sourdough Loaf", quantity: 1, unitPrice: 7.50 },
          { productId: "prod_croissant", productName: "Butter Croissant", quantity: 3, unitPrice: 2.50 },
          { productId: "prod_cinnamon", productName: "Cinnamon Swirl Roll", quantity: 1, unitPrice: 3.50 },
        ]},
      },
    });

    // Alerts
    await db.agentAlert.createMany({
      data: [
        { bakeryId: bakery.id, type: "SHORTFALL", severity: "WARNING", title: "Wholemeal Flour running low", message: "Current stock (8 kg) is below the reorder threshold of 10 kg. Recommended order: 15 kg from Shipton Mill (2-day lead time).", relatedEntityId: wholeMealFlour.id, relatedEntityType: "Ingredient" },
        { bakeryId: bakery.id, type: "SHORTFALL", severity: "WARNING", title: "Dark Chocolate below reorder level", message: "Current stock (2.5 kg) is below the reorder threshold of 3 kg. Next batch of brownies requires 300g per batch. Order from Callebaut UK (3-day lead time).", relatedEntityId: darkChocolate.id, relatedEntityType: "Ingredient" },
        { bakeryId: bakery.id, type: "SHORTFALL", severity: "WARNING", title: "Frozen Raspberries running low", message: "Current stock (1.5 kg) is below the reorder threshold of 2 kg. Seasonal availability may cause delays — order early.", relatedEntityId: frozenRaspberries.id, relatedEntityType: "Ingredient" },
        { bakeryId: bakery.id, type: "PROCUREMENT", severity: "INFO", title: "Large conference order received", message: "London Fields Hotel placed an order for 50 croissants + 30 cinnamon rolls + 25 brownies for day after tomorrow. Verify stock levels cover this demand." },
      ],
    });

    // Production Schedule (today)
    const today = new Date();
    const scheduleDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const schedule = await db.productionSchedule.create({
      data: {
        bakeryId: bakery.id, scheduleDate, shiftType: ShiftType.MORNING,
        isAutoGenerated: true, isApproved: true, approvedById: headBaker.id, approvedAt: new Date(),
        totalOvenUtilizationPercent: 82,
        aiNotes: "Morning shift: 3 batches scheduled. Sourdough is priority for wholesale (Bloom & Bean + Green Pantry). Croissants running as double batch for retail demand + Sophie Williams order. Focaccia added for Green Pantry trial. Oven utilisation 82% — tight but manageable with staggered bake times.",
      },
    });

    const sourdoughBatch = await db.productionBatch.create({
      data: { scheduleId: schedule.id, recipeId: sourdoughRecipe.id, shiftType: ShiftType.MORNING, status: "IN_PROGRESS", quantity: 10, scaleFactor: 5, plannedStartTime: new Date(scheduleDate.getTime() + 5.5 * 60 * 60 * 1000), plannedEndTime: new Date(scheduleDate.getTime() + 12 * 60 * 60 * 1000), ovenSlots: 2, notes: "5x batch — 10 loaves for wholesale orders + retail buffer" },
    });

    const croissantBatch = await db.productionBatch.create({
      data: { scheduleId: schedule.id, recipeId: croissantRecipe.id, shiftType: ShiftType.MORNING, status: "SCHEDULED", quantity: 36, scaleFactor: 3, plannedStartTime: new Date(scheduleDate.getTime() + 6 * 60 * 60 * 1000), plannedEndTime: new Date(scheduleDate.getTime() + 11 * 60 * 60 * 1000), ovenSlots: 1, notes: "Triple batch — 36 croissants (wholesale 24 + retail 6 + buffer 6)" },
    });

    const focacciaBatch = await db.productionBatch.create({
      data: { scheduleId: schedule.id, recipeId: focaccia.id, shiftType: ShiftType.MORNING, status: "SCHEDULED", quantity: 8, scaleFactor: 8, plannedStartTime: new Date(scheduleDate.getTime() + 7 * 60 * 60 * 1000), plannedEndTime: new Date(scheduleDate.getTime() + 11.5 * 60 * 60 * 1000), ovenSlots: 1, notes: "8 trays for Green Pantry trial order" },
    });

    // Checklists
    await db.checklistItem.createMany({
      data: [
        { batchId: sourdoughBatch.id, order: 1, description: "Weigh 4.5 kg bread flour", status: "DONE", completedById: floorStaff.id, completedAt: new Date() },
        { batchId: sourdoughBatch.id, order: 2, description: "Add 90g salt and 3L water", status: "DONE", completedById: floorStaff.id, completedAt: new Date() },
        { batchId: sourdoughBatch.id, order: 3, description: "Mix on low speed 10 min, medium 5 min", status: "DONE", completedById: floorStaff.id, completedAt: new Date() },
        { batchId: sourdoughBatch.id, order: 4, description: "Autolyse rest — cover and leave 30 min", status: "IN_PROGRESS" },
        { batchId: sourdoughBatch.id, order: 5, description: "Bulk ferment at 25°C for 4 hours (stretch & fold every 45 min)", status: "PENDING" },
        { batchId: sourdoughBatch.id, order: 6, description: "Divide into 10 pieces, pre-shape rounds", status: "PENDING" },
        { batchId: sourdoughBatch.id, order: 7, description: "Bench rest 20 min, final shape into bannetons", status: "PENDING" },
        { batchId: sourdoughBatch.id, order: 8, description: "Cold retard (if overnight) or final proof 1 hour", status: "PENDING" },
        { batchId: sourdoughBatch.id, order: 9, description: "Score loaves, load into oven at 250°C with steam", status: "PENDING" },
        { batchId: sourdoughBatch.id, order: 10, description: "Bake 25 min with steam, 20 min vented", status: "PENDING" },
        { batchId: sourdoughBatch.id, order: 11, description: "Cool on wire rack 60 min — do not bag hot", status: "PENDING" },
      ],
    });

    await db.checklistItem.createMany({
      data: [
        { batchId: croissantBatch.id, order: 1, description: "Weigh 1.5 kg flour, 30g yeast, 30g salt, 165g eggs, 450ml milk, 150g sugar", status: "PENDING" },
        { batchId: croissantBatch.id, order: 2, description: "Mix détrempe — 15 min on medium speed until smooth", status: "PENDING" },
        { batchId: croissantBatch.id, order: 3, description: "Wrap and chill détrempe 1 hour", status: "PENDING" },
        { batchId: croissantBatch.id, order: 4, description: "Prepare 840g butter block (pound flat, 20×20cm)", status: "PENDING" },
        { batchId: croissantBatch.id, order: 5, description: "Enclose butter, first letter fold", status: "PENDING" },
        { batchId: croissantBatch.id, order: 6, description: "Rest 30 min, second fold, rest 30 min, third fold", status: "PENDING" },
        { batchId: croissantBatch.id, order: 7, description: "Roll to 4mm, cut 36 triangles", status: "PENDING" },
        { batchId: croissantBatch.id, order: 8, description: "Shape croissants, place on lined trays", status: "PENDING" },
        { batchId: croissantBatch.id, order: 9, description: "Egg wash, proof at 27°C for 2 hours until doubled", status: "PENDING" },
        { batchId: croissantBatch.id, order: 10, description: "Second egg wash, bake at 190°C for 18 minutes", status: "PENDING" },
        { batchId: croissantBatch.id, order: 11, description: "Cool on rack — do not stack", status: "PENDING" },
      ],
    });

    await db.checklistItem.createMany({
      data: [
        { batchId: focacciaBatch.id, order: 1, description: "Weigh 4 kg flour, 640ml olive oil, 96g salt, 40g yeast", status: "PENDING" },
        { batchId: focacciaBatch.id, order: 2, description: "Mix high-hydration dough (80% water)", status: "PENDING" },
        { batchId: focacciaBatch.id, order: 3, description: "Bulk ferment 3 hours — fold every 45 min", status: "PENDING" },
        { batchId: focacciaBatch.id, order: 4, description: "Oil 8 trays, divide dough, stretch to fill", status: "PENDING" },
        { batchId: focacciaBatch.id, order: 5, description: "Dimple, drizzle oil, add rosemary & flaky salt", status: "PENDING" },
        { batchId: focacciaBatch.id, order: 6, description: "Final proof 30 min", status: "PENDING" },
        { batchId: focacciaBatch.id, order: 7, description: "Bake at 220°C for 25 min until deep golden", status: "PENDING" },
        { batchId: focacciaBatch.id, order: 8, description: "Rest 5 min in pan, then transfer to cooling rack", status: "PENDING" },
      ],
    });

    // Procurement Recommendations
    await db.procurementRecommendation.createMany({
      data: [
        { bakeryId: bakery.id, ingredientId: wholeMealFlour.id, currentStockGrams: 8000, requiredGrams: 10000, shortfallGrams: 2000, recommendedOrderGrams: 15000, supplierId: flourSupplier.id, estimatedCost: 16.50, urgency: "HIGH" },
        { bakeryId: bakery.id, ingredientId: darkChocolate.id, currentStockGrams: 2500, requiredGrams: 3000, shortfallGrams: 500, recommendedOrderGrams: 5000, supplierId: chocolateSupplier.id, estimatedCost: 72.50, urgency: "MEDIUM" },
        { bakeryId: bakery.id, ingredientId: frozenRaspberries.id, currentStockGrams: 1500, requiredGrams: 2000, shortfallGrams: 500, recommendedOrderGrams: 4000, supplierId: fruitSupplier.id, estimatedCost: 36.00, urgency: "MEDIUM" },
        { bakeryId: bakery.id, ingredientId: doubleCream.id, currentStockGrams: 4000, requiredGrams: 3000, shortfallGrams: 0, recommendedOrderGrams: 6000, supplierId: dairySupplier.id, estimatedCost: 22.80, urgency: "LOW" },
      ],
    });

    return ok({ message: "Demo data reset successfully", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[Demo Reset]", err);
    const message = err instanceof Error ? err.message : "Reset failed";
    return error(message, 500);
  }
}
