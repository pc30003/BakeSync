import { PrismaClient, UserRole, RecipeCategory, RecipeStageType, IngredientCategory, OrderChannel, OrderStatus, ShiftType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding BakeSync database...");

  // ── Bakery ──────────────────────────────────────────────────────────────
  const bakery = await prisma.bakery.upsert({
    where: { id: "bakery_demo" },
    update: {},
    create: {
      id: "bakery_demo",
      name: "The Artisan Loaf",
      timezone: "Europe/London",
      openingTime: "05:30",
      closingTime: "18:00",
      currency: "GBP",
    },
  });
  console.log(`✅ Bakery: ${bakery.name}`);

  // ── Users ────────────────────────────────────────────────────────────────
  const headBaker = await prisma.user.upsert({
    where: { email: "head@artisanloaf.com" },
    update: {},
    create: {
      email: "head@artisanloaf.com",
      name: "Sarah Chen",
      role: UserRole.HEAD_BAKER,
      bakeryId: bakery.id,
    },
  });

  const floorStaff = await prisma.user.upsert({
    where: { email: "floor@artisanloaf.com" },
    update: {},
    create: {
      email: "floor@artisanloaf.com",
      name: "Marcus Webb",
      role: UserRole.FLOOR_STAFF,
      bakeryId: bakery.id,
    },
  });

  const purchasingManager = await prisma.user.upsert({
    where: { email: "purchasing@artisanloaf.com" },
    update: {},
    create: {
      email: "purchasing@artisanloaf.com",
      name: "Priya Patel",
      role: UserRole.PURCHASING_MANAGER,
      bakeryId: bakery.id,
    },
  });
  console.log(`✅ Users: ${[headBaker, floorStaff, purchasingManager].map(u => u.name).join(", ")}`);

  // ── Suppliers ────────────────────────────────────────────────────────────
  const flourSupplier = await prisma.supplier.create({
    data: {
      bakeryId: bakery.id,
      name: "Shipton Mill",
      contactEmail: "orders@shiptonmill.com",
      contactPhone: "+44 1453 800123",
      leadTimeDays: 2,
    },
  });

  const dairySupplier = await prisma.supplier.create({
    data: {
      bakeryId: bakery.id,
      name: "County Dairy Direct",
      contactEmail: "supply@countydairy.co.uk",
      leadTimeDays: 1,
    },
  });
  console.log(`✅ Suppliers: ${[flourSupplier, dairySupplier].map(s => s.name).join(", ")}`);

  // ── Ingredients ──────────────────────────────────────────────────────────
  const strongFlour = await prisma.ingredient.create({
    data: {
      bakeryId: bakery.id,
      name: "Strong White Bread Flour",
      category: IngredientCategory.FLOUR,
      unit: "kg",
      stockGrams: 25000,
      reorderThresholdGrams: 10000,
      criticalThresholdGrams: 3000,
      costPerKg: 0.85,
      supplierId: flourSupplier.id,
      alertLevel: "OK",
    },
  });

  const wholeMealFlour = await prisma.ingredient.create({
    data: {
      bakeryId: bakery.id,
      name: "Wholemeal Flour",
      category: IngredientCategory.FLOUR,
      unit: "kg",
      stockGrams: 8000,
      reorderThresholdGrams: 5000,
      criticalThresholdGrams: 1500,
      costPerKg: 1.10,
      supplierId: flourSupplier.id,
      alertLevel: "LOW",
    },
  });

  const butter = await prisma.ingredient.create({
    data: {
      bakeryId: bakery.id,
      name: "Unsalted Butter",
      category: IngredientCategory.FAT,
      unit: "kg",
      stockGrams: 5000,
      reorderThresholdGrams: 2000,
      criticalThresholdGrams: 500,
      costPerKg: 6.50,
      supplierId: dairySupplier.id,
      alertLevel: "OK",
    },
  });

  const instantYeast = await prisma.ingredient.create({
    data: {
      bakeryId: bakery.id,
      name: "Instant Dried Yeast",
      category: IngredientCategory.LEAVENING,
      unit: "g",
      stockGrams: 2000,
      reorderThresholdGrams: 500,
      criticalThresholdGrams: 100,
      costPerKg: 12.00,
      alertLevel: "OK",
    },
  });

  const salt = await prisma.ingredient.create({
    data: {
      bakeryId: bakery.id,
      name: "Fine Sea Salt",
      category: IngredientCategory.SALT,
      unit: "g",
      stockGrams: 5000,
      reorderThresholdGrams: 1000,
      criticalThresholdGrams: 200,
      costPerKg: 1.20,
      alertLevel: "OK",
    },
  });

  const eggs = await prisma.ingredient.create({
    data: {
      bakeryId: bakery.id,
      name: "Free Range Eggs (Large)",
      category: IngredientCategory.EGG,
      unit: "units",
      stockGrams: 3600,   // ~60g each × 60 eggs
      reorderThresholdGrams: 1200,
      criticalThresholdGrams: 300,
      costPerKg: 3.20,
      supplierId: dairySupplier.id,
      alertLevel: "OK",
    },
  });
  console.log(`✅ Ingredients seeded`);

  // ── Recipes ──────────────────────────────────────────────────────────────
  const sourdoughRecipe = await prisma.recipe.create({
    data: {
      bakeryId: bakery.id,
      name: "Classic Sourdough Loaf",
      category: RecipeCategory.BREAD,
      description: "Traditional long-ferment sourdough with a crisp crust and open crumb.",
      yieldQuantity: 2,
      yieldUnit: "loaves",
      batchSizeMultiplier: 1,
      wastageBufferPercent: 3,
      shelfLifeHours: 48,
      isActive: true,
      ingredients: {
        create: [
          { ingredientId: strongFlour.id, quantityGrams: 900,  displayUnit: "g" },
          { ingredientId: salt.id,        quantityGrams: 18,   displayUnit: "g" },
        ],
      },
      stages: {
        create: [
          { order: 1, type: RecipeStageType.MIX,          name: "Mix dough",         durationMinutes: 20, requiresOven: false },
          { order: 2, type: RecipeStageType.AUTOLYSE,     name: "Autolyse rest",      durationMinutes: 30, requiresOven: false },
          { order: 3, type: RecipeStageType.BULK_FERMENT, name: "Bulk fermentation",  durationMinutes: 240, requiresOven: false },
          { order: 4, type: RecipeStageType.SHAPE,        name: "Shape loaves",       durationMinutes: 20, requiresOven: false },
          { order: 5, type: RecipeStageType.RETARD,       name: "Overnight retard",   durationMinutes: 720, requiresOven: false },
          { order: 6, type: RecipeStageType.BAKE,         name: "Bake in dutch oven", durationMinutes: 45, requiresOven: true, ovenTempCelsius: 250 },
          { order: 7, type: RecipeStageType.COOL,         name: "Cool on rack",       durationMinutes: 60, requiresOven: false },
        ],
      },
    },
  });

  const croissantRecipe = await prisma.recipe.create({
    data: {
      bakeryId: bakery.id,
      name: "Butter Croissant",
      category: RecipeCategory.VIENNOISERIE,
      description: "Classic laminated pastry with 27 layers of butter.",
      yieldQuantity: 12,
      yieldUnit: "croissants",
      batchSizeMultiplier: 1,
      wastageBufferPercent: 5,
      shelfLifeHours: 12,
      isActive: true,
      ingredients: {
        create: [
          { ingredientId: strongFlour.id, quantityGrams: 500,  displayUnit: "g" },
          { ingredientId: butter.id,      quantityGrams: 280,  displayUnit: "g" },
          { ingredientId: instantYeast.id, quantityGrams: 10,  displayUnit: "g" },
          { ingredientId: salt.id,        quantityGrams: 10,   displayUnit: "g" },
          { ingredientId: eggs.id,        quantityGrams: 55,   displayUnit: "g" },
        ],
      },
      stages: {
        create: [
          { order: 1, type: RecipeStageType.MIX,          name: "Make détrempe",        durationMinutes: 15, requiresOven: false },
          { order: 2, type: RecipeStageType.RETARD,       name: "Chill dough",          durationMinutes: 60, requiresOven: false },
          { order: 3, type: RecipeStageType.SHAPE,        name: "Laminate & fold",      durationMinutes: 45, requiresOven: false },
          { order: 4, type: RecipeStageType.RETARD,       name: "Rest between folds",   durationMinutes: 30, requiresOven: false },
          { order: 5, type: RecipeStageType.SHAPE,        name: "Cut & shape",          durationMinutes: 20, requiresOven: false },
          { order: 6, type: RecipeStageType.PROOF,        name: "Final proof",          durationMinutes: 120, requiresOven: false },
          { order: 7, type: RecipeStageType.BAKE,         name: "Bake",                 durationMinutes: 18, requiresOven: true, ovenTempCelsius: 190 },
          { order: 8, type: RecipeStageType.COOL,         name: "Cool",                 durationMinutes: 20, requiresOven: false },
        ],
      },
    },
  });
  console.log(`✅ Recipes: ${[sourdoughRecipe, croissantRecipe].map(r => r.name).join(", ")}`);

  // ── Sample Orders ────────────────────────────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  await prisma.order.createMany({
    data: [
      {
        bakeryId: bakery.id,
        channel: OrderChannel.WHOLESALE,
        status: OrderStatus.CONFIRMED,
        customerName: "Bloom & Bean Café",
        customerEmail: "orders@bloomandbean.com",
        fulfilmentDate: tomorrow,
        totalValue: 148.50,
        notes: "Weekly standing order — delivery by 07:30",
      },
      {
        bakeryId: bakery.id,
        channel: OrderChannel.ECOMMERCE,
        status: OrderStatus.PENDING,
        customerName: "James Harrington",
        customerEmail: "jharrington@email.com",
        fulfilmentDate: tomorrow,
        totalValue: 22.00,
        notes: null,
      },
    ],
  });
  console.log(`✅ Sample orders created`);

  // ── Agent Alert ──────────────────────────────────────────────────────────
  await prisma.agentAlert.create({
    data: {
      bakeryId: bakery.id,
      type: "SHORTFALL",
      severity: "WARNING",
      title: "Wholemeal Flour running low",
      message: "Current stock (8 kg) will not cover tomorrow's scheduled production. Recommended order: 15 kg from Shipton Mill.",
      relatedEntityId: wholeMealFlour.id,
      relatedEntityType: "Ingredient",
    },
  });
  console.log(`✅ Sample agent alert created`);

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
