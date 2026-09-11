import { PrismaClient, UserRole, RecipeCategory, RecipeStageType, IngredientCategory, OrderChannel, OrderStatus, ShiftType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding BakeSync database...");

  const demoPassword = await bcrypt.hash("demo1234", 10);

  // ── Bakery ──────────────────────────────────────────────────────────────
  const bakery = await prisma.bakery.upsert({
    where: { id: "bakery_demo" },
    update: {},
    create: {
      id: "bakery_demo",
      name: "The Artisan Loaf",
      timezone: "Europe/London",
      openingTime: "06:30",
      closingTime: "22:00",
      currency: "USD",
      ovenCount: 3,
      isOnboarded: true,
    },
  });
  console.log(`✅ Bakery: ${bakery.name}`);

  // ── Users ────────────────────────────────────────────────────────────────
  const headBaker = await prisma.user.upsert({
    where: { email: "head@artisanloaf.com" },
    update: { password: demoPassword },
    create: { id: "user_demo_head", email: "head@artisanloaf.com", name: "Sarah Chen", role: UserRole.HEAD_BAKER, password: demoPassword, bakeryId: bakery.id },
  });
  const floorStaff = await prisma.user.upsert({
    where: { email: "floor@artisanloaf.com" },
    update: { password: demoPassword },
    create: { id: "user_demo_floor", email: "floor@artisanloaf.com", name: "Marcus Webb", role: UserRole.FLOOR_STAFF, password: demoPassword, bakeryId: bakery.id },
  });
  const purchasingManager = await prisma.user.upsert({
    where: { email: "purchasing@artisanloaf.com" },
    update: { password: demoPassword },
    create: { id: "user_demo_purchasing", email: "purchasing@artisanloaf.com", name: "Priya Patel", role: UserRole.PURCHASING_MANAGER, password: demoPassword, bakeryId: bakery.id },
  });
  console.log(`✅ Users: ${[headBaker, floorStaff, purchasingManager].map(u => u.name).join(", ")}`);

  // ── Suppliers ────────────────────────────────────────────────────────────
  const chocolateSupplier = await prisma.supplier.create({
    data: { bakeryId: bakery.id, name: "Callebaut UK", contactEmail: "orders@callebaut.co.uk", contactPhone: "+44 20 7946 0958", leadTimeDays: 3, isActive: true, notes: "Belgian couverture chocolate. Min order £50." },
  });
  const dairySupplier = await prisma.supplier.create({
    data: { bakeryId: bakery.id, name: "County Dairy Direct", contactEmail: "supply@countydairy.co.uk", contactPhone: "+44 1234 567890", leadTimeDays: 1, isActive: true, notes: "Next-day delivery for cream, butter, milk." },
  });
  const generalSupplier = await prisma.supplier.create({
    data: { bakeryId: bakery.id, name: "BakeStock Wholesale", contactEmail: "orders@bakestock.co.uk", contactPhone: "+44 161 555 0100", leadTimeDays: 2, isActive: true, notes: "Dry goods, sugar, flour, gelatin, purees." },
  });
  console.log(`✅ Suppliers: 3 created`);

  // ── Ingredients (only what brownies + panna cotta need) ──────────────────
  const darkChocolate = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Dark Chocolate 70% (Callebaut)", category: IngredientCategory.CHOCOLATE, unit: "kg", stockGrams: 5000, reorderThresholdGrams: 2000, criticalThresholdGrams: 800, costPerKg: 14.50, supplierId: chocolateSupplier.id, alertLevel: "OK" },
  });
  const butter = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Unsalted Butter (82% fat)", category: IngredientCategory.FAT, unit: "kg", stockGrams: 8000, reorderThresholdGrams: 3000, criticalThresholdGrams: 1000, costPerKg: 6.50, supplierId: dairySupplier.id, alertLevel: "OK" },
  });
  const casterSugar = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Caster Sugar", category: IngredientCategory.SWEETENER, unit: "kg", stockGrams: 10000, reorderThresholdGrams: 3000, criticalThresholdGrams: 1000, costPerKg: 0.95, supplierId: generalSupplier.id, alertLevel: "OK" },
  });
  const eggs = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Free Range Eggs (Large)", category: IngredientCategory.EGG, unit: "units", stockGrams: 7200, reorderThresholdGrams: 2400, criticalThresholdGrams: 600, costPerKg: 3.20, supplierId: dairySupplier.id, alertLevel: "OK" },
  });
  const cakeFlour = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Cake Flour (Low Protein)", category: IngredientCategory.FLOUR, unit: "kg", stockGrams: 6000, reorderThresholdGrams: 2000, criticalThresholdGrams: 800, costPerKg: 1.20, supplierId: generalSupplier.id, alertLevel: "OK" },
  });
  const vanillaExtract = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Vanilla Extract (Madagascar)", category: IngredientCategory.SPICE, unit: "ml", stockGrams: 500, reorderThresholdGrams: 150, criticalThresholdGrams: 50, costPerKg: 85.00, supplierId: generalSupplier.id, alertLevel: "OK" },
  });
  const salt = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Fine Sea Salt", category: IngredientCategory.SALT, unit: "g", stockGrams: 5000, reorderThresholdGrams: 1000, criticalThresholdGrams: 300, costPerKg: 1.20, supplierId: generalSupplier.id, alertLevel: "OK" },
  });
  const heavyCream = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Heavy Cream (35% fat)", category: IngredientCategory.DAIRY, unit: "ml", stockGrams: 5000, reorderThresholdGrams: 2000, criticalThresholdGrams: 500, costPerKg: 4.50, supplierId: dairySupplier.id, alertLevel: "OK" },
  });
  const wholeMilk = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Whole Milk", category: IngredientCategory.LIQUID, unit: "ml", stockGrams: 8000, reorderThresholdGrams: 3000, criticalThresholdGrams: 1000, costPerKg: 1.10, supplierId: dairySupplier.id, alertLevel: "OK" },
  });
  const gelatinPowder = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Gelatin Powder", category: IngredientCategory.OTHER, unit: "g", stockGrams: 200, reorderThresholdGrams: 80, criticalThresholdGrams: 20, costPerKg: 32.00, supplierId: generalSupplier.id, alertLevel: "OK" },
  });
  const mangoPuree = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Mango & Apricot Puree", category: IngredientCategory.FRUIT, unit: "ml", stockGrams: 2000, reorderThresholdGrams: 800, criticalThresholdGrams: 200, costPerKg: 9.50, supplierId: generalSupplier.id, alertLevel: "OK" },
  });
  const limeJuice = await prisma.ingredient.create({
    data: { bakeryId: bakery.id, name: "Fresh Lime Juice", category: IngredientCategory.FRUIT, unit: "ml", stockGrams: 500, reorderThresholdGrams: 200, criticalThresholdGrams: 50, costPerKg: 6.00, supplierId: generalSupplier.id, alertLevel: "OK" },
  });
  console.log(`✅ Ingredients: 12 created`);

  // Ingredient lots with near-term expiry so the FEFO / expiry monitor has
  // real data to flag (kept in sync with app/api/demo/reset/route.ts).
  const daysFromNow = (d: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    dt.setHours(12, 0, 0, 0);
    return dt;
  };
  await prisma.ingredientLot.create({
    data: { ingredientId: heavyCream.id, supplierId: dairySupplier.id, lotCode: "HC-2409", quantityGrams: 1500, expiryDate: daysFromNow(2), costPerKg: 4.50 },
  });
  await prisma.ingredientLot.create({
    data: { ingredientId: mangoPuree.id, supplierId: generalSupplier.id, lotCode: "MP-2417", quantityGrams: 800, expiryDate: daysFromNow(1), costPerKg: 9.50 },
  });
  console.log(`✅ Ingredient lots: 2 created (near-term expiry for FEFO demo)`);

  // ── Recipes ──────────────────────────────────────────────────────────────

  // 1. Dark Chocolate Brownies (16 squares)
  const brownieRecipe = await prisma.recipe.create({
    data: {
      bakeryId: bakery.id, name: "Dark Chocolate Brownies", category: RecipeCategory.CAKE,
      description: "Rich, fudgy brownies made with 70% Belgian chocolate and a pinch of sea salt. Cut into 16 squares.",
      yieldQuantity: 2, yieldUnit: "7x7 inch tins", batchSizeMultiplier: 1, wastageBufferPercent: 2, shelfLifeHours: 72, isActive: true,
      ingredients: { create: [
        { ingredientId: darkChocolate.id, quantityGrams: 300, displayUnit: "g" },
        { ingredientId: butter.id, quantityGrams: 250, displayUnit: "g" },
        { ingredientId: casterSugar.id, quantityGrams: 350, displayUnit: "g" },
        { ingredientId: eggs.id, quantityGrams: 220, displayUnit: "g" },
        { ingredientId: cakeFlour.id, quantityGrams: 130, displayUnit: "g" },
        { ingredientId: vanillaExtract.id, quantityGrams: 5, displayUnit: "ml" },
        { ingredientId: salt.id, quantityGrams: 3, displayUnit: "g" },
      ]},
      stages: { create: [
        { order: 1, type: RecipeStageType.MIX, name: "Melt chocolate & butter", durationMinutes: 10, requiresOven: false },
        { order: 2, type: RecipeStageType.MIX, name: "Whisk eggs, sugar, vanilla, salt", durationMinutes: 5, requiresOven: false },
        { order: 3, type: RecipeStageType.MIX, name: "Fold together with flour", durationMinutes: 5, requiresOven: false },
        { order: 4, type: RecipeStageType.BAKE, name: "Bake (slightly underdone centre)", durationMinutes: 28, requiresOven: true, ovenTempCelsius: 170 },
        { order: 5, type: RecipeStageType.COOL, name: "Cool completely before cutting", durationMinutes: 60, requiresOven: false },
      ]},
    },
  });

  // 2. Mango & Apricot Panna Cotta (2 servings)
  const pannaCottaRecipe = await prisma.recipe.create({
    data: {
      bakeryId: bakery.id, name: "Mango & Apricot Panna Cotta", category: RecipeCategory.OTHER,
      description: "Silky vanilla cream panna cotta topped with a set mango & apricot fruit jelly layer. Served chilled.",
      yieldQuantity: 4, yieldUnit: "servings", batchSizeMultiplier: 1, wastageBufferPercent: 3, shelfLifeHours: 48, isActive: true,
      ingredients: { create: [
        { ingredientId: heavyCream.id, quantityGrams: 240, displayUnit: "g" },
        { ingredientId: wholeMilk.id, quantityGrams: 120, displayUnit: "g" },
        { ingredientId: casterSugar.id, quantityGrams: 50, displayUnit: "g" },
        { ingredientId: gelatinPowder.id, quantityGrams: 5, displayUnit: "g" },
        { ingredientId: vanillaExtract.id, quantityGrams: 5, displayUnit: "g" },
        { ingredientId: mangoPuree.id, quantityGrams: 130, displayUnit: "g" },
        { ingredientId: limeJuice.id, quantityGrams: 5, displayUnit: "g" },
      ]},
      stages: { create: [
        { order: 1, type: RecipeStageType.MIX, name: "Bloom gelatin for base", durationMinutes: 10, requiresOven: false },
        { order: 2, type: RecipeStageType.MIX, name: "Heat cream base", durationMinutes: 8, requiresOven: false },
        { order: 3, type: RecipeStageType.MIX, name: "Dissolve gelatin, add vanilla", durationMinutes: 3, requiresOven: false },
        { order: 4, type: RecipeStageType.COOL, name: "Strain into glasses, refrigerate 4 hours", durationMinutes: 240, requiresOven: false },
        { order: 5, type: RecipeStageType.MIX, name: "Bloom gelatin for fruit layer", durationMinutes: 10, requiresOven: false },
        { order: 6, type: RecipeStageType.MIX, name: "Warm puree, melt gelatin, add lime", durationMinutes: 5, requiresOven: false },
        { order: 7, type: RecipeStageType.COOL, name: "Pour fruit layer, refrigerate 1-2 hours", durationMinutes: 120, requiresOven: false },
      ]},
    },
  });
  console.log(`✅ Recipes: 2 created`);

  // ── Orders ───────────────────────────────────────────────────────────────
  // Stagger each order's createdAt so the "Received" column reads authentically
  // (orders arriving at different times), instead of all stamped at seed time.
  const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(9, 0, 0, 0);

  await prisma.order.create({
    data: {
      bakeryId: bakery.id, channel: OrderChannel.WHOLESALE, status: OrderStatus.CONFIRMED,
      customerName: "Bloom & Bean Café", customerEmail: "orders@bloomandbean.com",
      createdAt: hoursAgo(26), // ~yesterday — weekly standing order
      fulfilmentDate: tomorrow, totalValue: 96.00, notes: "Weekly standing order — delivery by 07:30",
      lineItems: { create: [
        { productId: "prod_brownie", productName: "Dark Chocolate Brownies (box of 16)", quantity: 3, unitPrice: 18.00 },
        { productId: "prod_pannacotta", productName: "Mango & Apricot Panna Cotta", quantity: 12, unitPrice: 3.50 },
      ]},
    },
  });

  await prisma.order.create({
    data: {
      bakeryId: bakery.id, channel: OrderChannel.ECOMMERCE, status: OrderStatus.PENDING,
      customerName: "Sophie Williams", customerEmail: "sophie.w@gmail.com",
      createdAt: hoursAgo(2), // recent online order
      fulfilmentDate: tomorrow, totalValue: 25.00,
      lineItems: { create: [
        { productId: "prod_brownie", productName: "Dark Chocolate Brownies (box of 4)", quantity: 2, unitPrice: 8.00 },
        { productId: "prod_pannacotta", productName: "Mango & Apricot Panna Cotta", quantity: 2, unitPrice: 4.50 },
      ]},
    },
  });

  await prisma.order.create({
    data: {
      bakeryId: bakery.id, channel: OrderChannel.MANUAL, status: OrderStatus.CONFIRMED,
      customerName: "London Fields Hotel", customerEmail: "events@londonfieldshotel.co.uk",
      createdAt: hoursAgo(48), // ~2 days ago — advance conference booking
      fulfilmentDate: dayAfter, totalValue: 180.00, notes: "Conference dessert platter — 40 pax",
      lineItems: { create: [
        { productId: "prod_brownie", productName: "Dark Chocolate Brownies", quantity: 32, unitPrice: 2.50 },
        { productId: "prod_pannacotta", productName: "Mango & Apricot Panna Cotta", quantity: 20, unitPrice: 4.00 },
      ]},
    },
  });

  await prisma.order.create({
    data: {
      bakeryId: bakery.id, channel: OrderChannel.ECOMMERCE, status: OrderStatus.CONFIRMED,
      customerName: "David & Maria Chen", customerEmail: "david.chen@proton.me",
      createdAt: hoursAgo(5), // earlier today
      fulfilmentDate: dayAfter, totalValue: 32.00, notes: "Birthday celebration",
      lineItems: { create: [
        { productId: "prod_brownie", productName: "Dark Chocolate Brownies (box of 16)", quantity: 1, unitPrice: 18.00 },
        { productId: "prod_pannacotta", productName: "Mango & Apricot Panna Cotta (6 pack)", quantity: 1, unitPrice: 14.00 },
      ]},
    },
  });

  await prisma.order.create({
    data: {
      bakeryId: bakery.id, channel: OrderChannel.POS, status: OrderStatus.IN_PRODUCTION,
      customerName: "Walk-in (counter)", customerEmail: null,
      createdAt: hoursAgo(0.4), // ~25 min ago — just came in at the counter
      fulfilmentDate: new Date(), totalValue: 12.50, notes: "Collected at counter",
      lineItems: { create: [
        { productId: "prod_brownie", productName: "Dark Chocolate Brownies (box of 4)", quantity: 1, unitPrice: 8.00 },
        { productId: "prod_pannacotta", productName: "Mango & Apricot Panna Cotta", quantity: 1, unitPrice: 4.50 },
      ]},
    },
  });
  console.log(`✅ Orders: 5 created`);

  // ── Agent Alerts ─────────────────────────────────────────────────────────
  await prisma.agentAlert.createMany({
    data: [
      {
        bakeryId: bakery.id, type: "SHORTFALL", severity: "WARNING",
        title: "Gelatin Powder stock low",
        message: "Current stock (200g) is above reorder but heavy upcoming demand for panna cotta (conference order: 20 servings = 45g gelatin) may push below threshold.",
        relatedEntityId: gelatinPowder.id, relatedEntityType: "Ingredient",
      },
      {
        bakeryId: bakery.id, type: "PROCUREMENT", severity: "INFO",
        title: "Large conference order received",
        message: "London Fields Hotel placed an order for 32 brownies + 20 panna cottas for day after tomorrow. Verify stock levels cover this demand.",
      },
    ],
  });
  console.log(`✅ Alerts: 2 created`);

  // ── Production Schedule (today, morning shift) ───────────────────────────
  // A single approved schedule for today with 2 batches. All steps start PENDING
  // so ticking one performs a real live stock deduction during the demo.
  const today = new Date();
  const scheduleDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  async function createShiftSchedule(shiftType: ShiftType) {
    const offset = 6; // morning batches start ~06:00 UTC

    const schedule = await prisma.productionSchedule.create({
      data: {
        bakeryId: bakery.id, scheduleDate, shiftType,
        isAutoGenerated: true, isApproved: true, approvedById: headBaker.id, approvedAt: new Date(),
        totalOvenUtilizationPercent: 33,
        aiNotes: "Morning shift: 2 batches scheduled. Brownies for Bloom & Bean + Sophie Williams orders. Panna cotta base needs 4h set time so started early for same-day fruit layer assembly.",
      },
    });

    // Batch 1: Brownies (3x batch = 48 squares for wholesale + retail)
    const brownieBatch = await prisma.productionBatch.create({
      data: {
        scheduleId: schedule.id, recipeId: brownieRecipe.id, shiftType,
        status: "SCHEDULED", quantity: 48, scaleFactor: 3,
        plannedStartTime: new Date(scheduleDate.getTime() + offset * 60 * 60 * 1000),
        plannedEndTime: new Date(scheduleDate.getTime() + (offset + 2) * 60 * 60 * 1000),
        ovenSlots: 1, notes: "3x batch — 48 squares for café order + retail",
      },
    });

    // Batch 2: Panna Cotta (7x batch = 28 servings)
    const pannaCottaBatch = await prisma.productionBatch.create({
      data: {
        scheduleId: schedule.id, recipeId: pannaCottaRecipe.id, shiftType,
        status: "SCHEDULED", quantity: 28, scaleFactor: 7,
        plannedStartTime: new Date(scheduleDate.getTime() + (offset - 0.5) * 60 * 60 * 1000),
        plannedEndTime: new Date(scheduleDate.getTime() + (offset + 6) * 60 * 60 * 1000),
        ovenSlots: 0, notes: "7x batch — 28 panna cottas (12 for café + 2 for Sophie + 14 buffer)",
      },
    });

    // ─ Brownie checklist (all PENDING — fresh for a clean demo) ─
    const brownieStep1 = await prisma.checklistItem.create({
      data: { batchId: brownieBatch.id, order: 1, description: "Melt 900g Dark Chocolate 70% and 750g Unsalted Butter together (double boiler or microwave in 30s bursts)", status: "PENDING" },
    });
    await prisma.checklistDeduction.createMany({
      data: [
        { checklistItemId: brownieStep1.id, ingredientId: darkChocolate.id, deductionGrams: 900 },
        { checklistItemId: brownieStep1.id, ingredientId: butter.id, deductionGrams: 750 },
      ],
    });

    const brownieStep2 = await prisma.checklistItem.create({
      data: { batchId: brownieBatch.id, order: 2, description: "Whisk 660g Free Range Eggs, 1050g Caster Sugar, 15ml Vanilla Extract, and 9g Fine Sea Salt until lighter in colour", status: "PENDING" },
    });
    await prisma.checklistDeduction.createMany({
      data: [
        { checklistItemId: brownieStep2.id, ingredientId: eggs.id, deductionGrams: 660 },
        { checklistItemId: brownieStep2.id, ingredientId: casterSugar.id, deductionGrams: 1050 },
        { checklistItemId: brownieStep2.id, ingredientId: vanillaExtract.id, deductionGrams: 15 },
        { checklistItemId: brownieStep2.id, ingredientId: salt.id, deductionGrams: 9 },
      ],
    });

    await prisma.checklistItem.create({
      data: { batchId: brownieBatch.id, order: 3, description: "Fold melted chocolate into egg mixture, then sift in 390g Cake Flour — fold until just combined", status: "PENDING", ingredientId: cakeFlour.id, deductionGrams: 390 },
    });

    await prisma.checklistItem.createMany({
      data: [
        { batchId: brownieBatch.id, order: 4, description: "Pour into 3 lined 23cm square tins, spread evenly", status: "PENDING" },
        { batchId: brownieBatch.id, order: 5, description: "Bake at 170°C for 28 minutes — centre should still wobble slightly", status: "PENDING" },
        { batchId: brownieBatch.id, order: 6, description: "Cool completely in tin (minimum 1 hour) before cutting into 16 squares each", status: "PENDING" },
      ],
    });

    // ─ Panna cotta checklist (7x batch: 4 servings × 7 = 28 servings) ─
    const pcStep1 = await prisma.checklistItem.create({
      data: { batchId: pannaCottaBatch.id, order: 1, description: "Bloom 24.5g Gelatin Powder in 147g cold water — leave 5-10 min until soft", status: "PENDING" },
    });
    await prisma.checklistDeduction.createMany({
      data: [
        { checklistItemId: pcStep1.id, ingredientId: gelatinPowder.id, deductionGrams: 24.5 },
      ],
    });

    const pcStep2 = await prisma.checklistItem.create({
      data: { batchId: pannaCottaBatch.id, order: 2, description: "Heat 1680g Heavy Cream, 840g Whole Milk, and 350g Caster Sugar — stir until dissolved, don't boil", status: "PENDING" },
    });
    await prisma.checklistDeduction.createMany({
      data: [
        { checklistItemId: pcStep2.id, ingredientId: heavyCream.id, deductionGrams: 1680 },
        { checklistItemId: pcStep2.id, ingredientId: wholeMilk.id, deductionGrams: 840 },
        { checklistItemId: pcStep2.id, ingredientId: casterSugar.id, deductionGrams: 350 },
      ],
    });

    await prisma.checklistItem.create({
      data: { batchId: pannaCottaBatch.id, order: 3, description: "Stir bloomed gelatin into hot cream until smooth, add 35g Vanilla Extract", status: "PENDING", ingredientId: vanillaExtract.id, deductionGrams: 35 },
    });

    await prisma.checklistItem.create({
      data: { batchId: pannaCottaBatch.id, order: 4, description: "Strain into 28 serving glasses (2/3 full), refrigerate 4 hours. Cover with cling wrap if storing overnight without fruit layer.", status: "PENDING" },
    });

    const pcStep5 = await prisma.checklistItem.create({
      data: { batchId: pannaCottaBatch.id, order: 5, description: "Bloom 10.5g Gelatin Powder in 63g cold water for fruit jelly layer", status: "PENDING" },
    });
    await prisma.checklistDeduction.createMany({
      data: [
        { checklistItemId: pcStep5.id, ingredientId: gelatinPowder.id, deductionGrams: 10.5 },
      ],
    });

    const pcStep6 = await prisma.checklistItem.create({
      data: { batchId: pannaCottaBatch.id, order: 6, description: "Warm 910g Mango & Apricot Puree, melt gelatin into it, add 35g Fresh Lime Juice", status: "PENDING" },
    });
    await prisma.checklistDeduction.createMany({
      data: [
        { checklistItemId: pcStep6.id, ingredientId: mangoPuree.id, deductionGrams: 910 },
        { checklistItemId: pcStep6.id, ingredientId: limeJuice.id, deductionGrams: 35 },
      ],
    });

    await prisma.checklistItem.create({
      data: { batchId: pannaCottaBatch.id, order: 7, description: "Pour fruit layer gently over set base, refrigerate 1-2 hours until set", status: "PENDING" },
    });
  }

  await createShiftSchedule(ShiftType.MORNING);

  console.log(`✅ Production schedule: 2 batches, 13 checklist items`);

  // ── Procurement Recommendations ──────────────────────────────────────────
  await prisma.procurementRecommendation.createMany({
    data: [
      {
        bakeryId: bakery.id, ingredientId: darkChocolate.id,
        currentStockGrams: 5000, requiredGrams: 2000, shortfallGrams: 0, recommendedOrderGrams: 5000,
        supplierId: chocolateSupplier.id, estimatedCost: 72.50, urgency: "LOW",
      },
      {
        bakeryId: bakery.id, ingredientId: mangoPuree.id,
        currentStockGrams: 2000, requiredGrams: 800, shortfallGrams: 0, recommendedOrderGrams: 3000,
        supplierId: generalSupplier.id, estimatedCost: 28.50, urgency: "MEDIUM",
      },
    ],
  });
  console.log(`✅ Procurement recommendations: 2 created`);

  console.log("\n🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
