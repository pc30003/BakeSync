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
  // Only available in demo mode
  if (!IS_DEMO) {
    return error("Not available in production mode", 403);
  }

  // Verify cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return error("Unauthorized", 401);
  }

  try {
    // ── Wipe existing demo data ──────────────────────────────────────────
    await db.agentAlert.deleteMany({           where: { bakeryId: "bakery_demo" } });
    await db.agentAction.deleteMany({          where: { bakeryId: "bakery_demo" } });
    await db.taskQueue.deleteMany({            where: { bakeryId: "bakery_demo" } });
    await db.procurementRecommendation.deleteMany({ where: { bakeryId: "bakery_demo" } });
    await db.wastageLog.deleteMany({           where: { bakeryId: "bakery_demo" } });
    await db.stockDeduction.deleteMany({       where: { bakeryId: "bakery_demo" } });
    await db.checklistItem.deleteMany({        where: { batch: { schedule: { bakeryId: "bakery_demo" } } } });
    await db.productionBatch.deleteMany({      where: { schedule: { bakeryId: "bakery_demo" } } });
    await db.productionSchedule.deleteMany({   where: { bakeryId: "bakery_demo" } });
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
        currency:    "GBP",
        isOnboarded: true,
      },
    });

    await db.user.createMany({
      data: [
        { email: "head@artisanloaf.com",       name: "Sarah Chen",   role: UserRole.HEAD_BAKER,          password: demoPassword, bakeryId: bakery.id },
        { email: "floor@artisanloaf.com",      name: "Marcus Webb",  role: UserRole.FLOOR_STAFF,         password: demoPassword, bakeryId: bakery.id },
        { email: "purchasing@artisanloaf.com", name: "Priya Patel",  role: UserRole.PURCHASING_MANAGER,  password: demoPassword, bakeryId: bakery.id },
      ],
    });

    const flourSupplier = await db.supplier.create({
      data: {
        bakeryId:      bakery.id,
        name:          "Shipton Mill",
        contactEmail:  "orders@shiptonmill.com",
        contactPhone:  "+44 1453 800123",
        leadTimeDays:  2,
        isActive:      true,
      },
    });

    await db.supplier.create({
      data: {
        bakeryId:     bakery.id,
        name:         "County Dairy Direct",
        contactEmail: "supply@countydairy.co.uk",
        leadTimeDays: 1,
        isActive:     true,
      },
    });

    // Ingredients
    await db.ingredient.createMany({
      data: [
        { bakeryId: bakery.id, name: "Strong Bread Flour",  category: IngredientCategory.FLOUR,  unit: "g",  stockGrams: 25000, reorderThresholdGrams: 10000, criticalThresholdGrams: 5000,  alertLevel: "OK",       supplierId: flourSupplier.id },
        { bakeryId: bakery.id, name: "Unsalted Butter",     category: IngredientCategory.DAIRY,  unit: "g",  stockGrams: 3000,  reorderThresholdGrams: 5000,  criticalThresholdGrams: 2000,  alertLevel: "LOW",      supplierId: null },
        { bakeryId: bakery.id, name: "Whole Milk",          category: IngredientCategory.DAIRY,  unit: "ml", stockGrams: 8000,  reorderThresholdGrams: 5000,  criticalThresholdGrams: 2000,  alertLevel: "OK",       supplierId: null },
        { bakeryId: bakery.id, name: "Fine Sea Salt",       category: IngredientCategory.OTHER,  unit: "g",  stockGrams: 2000,  reorderThresholdGrams: 1000,  criticalThresholdGrams: 500,   alertLevel: "OK",       supplierId: null },
        { bakeryId: bakery.id, name: "Instant Dried Yeast", category: IngredientCategory.OTHER,  unit: "g",  stockGrams: 500,   reorderThresholdGrams: 300,   criticalThresholdGrams: 100,   alertLevel: "OK",       supplierId: null },
        { bakeryId: bakery.id, name: "Caster Sugar",        category: IngredientCategory.SUGAR,  unit: "g",  stockGrams: 4000,  reorderThresholdGrams: 2000,  criticalThresholdGrams: 1000,  alertLevel: "OK",       supplierId: null },
        { bakeryId: bakery.id, name: "Free Range Eggs",     category: IngredientCategory.DAIRY,  unit: "g",  stockGrams: 600,   reorderThresholdGrams: 1200,  criticalThresholdGrams: 600,   alertLevel: "CRITICAL", supplierId: null },
      ],
    });

    // Agent alert
    await db.agentAlert.create({
      data: {
        bakeryId:  bakery.id,
        type:      "LOW_STOCK",
        severity:  "WARNING",
        title:     "Butter stock running low",
        message:   "Unsalted Butter is below reorder threshold. Current stock: 3kg. Recommended order: 10kg from County Dairy Direct.",
        isRead:    false,
        isDismissed: false,
      },
    });

    // Orders
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.order.create({
      data: {
        bakeryId:      bakery.id,
        channel:       OrderChannel.WHOLESALE,
        status:        OrderStatus.CONFIRMED,
        customerName:  "Bloom & Bean Café",
        customerEmail: "orders@bloomandbean.com",
        fulfilmentDate: tomorrow,
        totalValue:    148.50,
        lineItems: {
          create: [
            { productName: "Classic Sourdough Loaf", quantity: 12, unitPrice: 7.50 },
            { productName: "Butter Croissant",        quantity: 24, unitPrice: 2.25 },
          ],
        },
      },
    });

    return ok({ message: "Demo data reset successfully", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[Demo Reset]", err);
    const message = err instanceof Error ? err.message : "Reset failed";
    return error(message, 500);
  }
}
