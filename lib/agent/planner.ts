/**
 * lib/agent/planner.ts
 *
 * Sends the bakery context to OpenAI and receives back a structured
 * AgentSchedulePlan via function calling / structured outputs.
 *
 * The LLM is instructed to act as a master baker and production planner.
 * It must respect hard constraints (oven capacity, ingredient availability,
 * stage sequencing) and apply bakery domain knowledge (proofing times,
 * retard scheduling, FEFO consumption order).
 */

import OpenAI from "openai";
import type { AgentBakeryContext, AgentSchedulePlan, AgentPlannedBatch } from "./types";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are BakeSync, an expert autonomous production planner for a commercial bakery.
Your job is to generate an optimal production schedule for a given shift.

## Your responsibilities
1. Analyse all pending orders and determine which products need to be baked for the target date.
2. For each product, look up the recipe and calculate the exact batch quantity needed to fulfil orders (accounting for yield per batch and the wastage buffer).
3. Schedule each batch within the shift window, respecting:
   - Multi-stage baking timelines (autolyse → bulk ferment → shape → proof → retard → bake → cool)
   - Oven slot capacity (do not schedule more batches in the oven simultaneously than ovenCount allows)
   - Ingredient stock levels — if stock is insufficient, reduce batch quantity and flag a shortfall
   - FEFO: use ingredients expiring soonest first
   - Shelf life: only produce what can be sold before the product expires
4. Generate a clear step-by-step checklist for each batch. IMPORTANT: In every step that involves weighing or using ingredients, include the FULL ingredient name and exact quantity. For example: "Weigh 4.5 kg Strong White Bread Flour into mixing bowl" NOT "Weigh flour". "Add 90g Fine Sea Salt and 3L water" NOT "Add salt and water". "Prepare 840g Unsalted Butter block" NOT "Prepare butter block". Always use the exact ingredient names provided in the recipe data.
5. Provide a brief plain-English reasoning summary in aiNotes.

## Hard constraints
- Do not schedule batches that would require ingredients that are completely out of stock.
- Do not exceed oven capacity at any point.
- Planned start and end times must fall within the shift window.
- scaleFactor must be a positive number (minimum 0.5, maximum 20).

## Output format
You MUST respond ONLY by calling the create_production_schedule function with valid JSON arguments.
Do not include any text outside the function call.`;

// ─── JSON Schema for function calling ────────────────────────────────────────

const CREATE_SCHEDULE_FUNCTION: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_production_schedule",
    description: "Creates an optimised production schedule for the shift",
    parameters: {
      type: "object",
      required: ["batches", "warnings", "aiNotes", "ovenUtilizationPercent"],
      properties: {
        batches: {
          type: "array",
          description: "Ordered list of production batches for this shift",
          items: {
            type: "object",
            required: [
              "recipeId", "recipeName", "quantity", "scaleFactor",
              "plannedStartTime", "plannedEndTime", "ovenSlots",
              "checklistSteps", "ingredientRequirements",
            ],
            properties: {
              recipeId:         { type: "string" },
              recipeName:       { type: "string" },
              quantity:         { type: "number", description: "Number of units to produce" },
              scaleFactor:      { type: "number", description: "Recipe multiplier (e.g. 2 = double batch)" },
              plannedStartTime: { type: "string", description: "ISO 8601 datetime" },
              plannedEndTime:   { type: "string", description: "ISO 8601 datetime" },
              ovenSlots:        { type: "number", description: "Number of oven slots required simultaneously" },
              checklistSteps: {
                type: "array",
                items: { type: "string" },
                description: "Ordered step-by-step instructions for kitchen staff",
              },
              ingredientRequirements: {
                type: "array",
                items: {
                  type: "object",
                  required: ["ingredientId", "name", "requiredGrams", "availableGrams", "shortfallGrams"],
                  properties: {
                    ingredientId:  { type: "string" },
                    name:          { type: "string" },
                    requiredGrams: { type: "number" },
                    availableGrams: { type: "number" },
                    shortfallGrams: { type: "number" },
                  },
                },
              },
            },
          },
        },
        warnings: {
          type: "array",
          items: { type: "string" },
          description: "Non-blocking warnings (e.g. low stock, expiring lots)",
        },
        aiNotes: {
          type: "string",
          description: "Plain-English summary of the scheduling decisions made",
        },
        ovenUtilizationPercent: {
          type: "number",
          description: "Estimated oven utilisation across the shift (0-100)",
        },
      },
    },
  },
};

// ─── Main planner function ────────────────────────────────────────────────────

export async function runPlanner(context: AgentBakeryContext): Promise<AgentSchedulePlan> {
  const userMessage = buildUserMessage(context);

  const response = await getOpenAI().chat.completions.create({
    model: MODEL,
    temperature: 0.2,   // low temperature — we want deterministic scheduling logic
    max_tokens: 4096,
    tools: [CREATE_SCHEDULE_FUNCTION],
    tool_choice: { type: "function", function: { name: "create_production_schedule" } },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userMessage },
    ],
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== "create_production_schedule") {
    throw new Error("OpenAI did not return a valid create_production_schedule function call");
  }

  let parsed: AgentSchedulePlan;
  try {
    parsed = JSON.parse(toolCall.function.arguments) as AgentSchedulePlan;
  } catch (e) {
    throw new Error(`Failed to parse OpenAI function call arguments: ${e}`);
  }

  // Validate minimal structure
  if (!Array.isArray(parsed.batches)) {
    throw new Error("Invalid plan: batches must be an array");
  }

  return parsed;
}

// ─── Build user message from context ─────────────────────────────────────────

function buildUserMessage(ctx: AgentBakeryContext): string {
  const lines: string[] = [
    `# Production Planning Request`,
    ``,
    `**Bakery:** ${ctx.bakeryName}`,
    `**Date:** ${ctx.targetDate}`,
    `**Shift:** ${ctx.shiftType} (${ctx.shiftWindow.startTime} – ${ctx.shiftWindow.endTime})`,
    `**Oven slots available:** ${ctx.ovenCount}`,
    ``,
    `## Pending Orders (${ctx.pendingOrders.length})`,
  ];

  if (ctx.pendingOrders.length === 0) {
    lines.push("No pending orders. Generate a standard standing production run based on typical demand.");
  } else {
    for (const order of ctx.pendingOrders) {
      lines.push(
        `- Order ${order.orderId.slice(-6)} | ${order.channel} | Due: ${order.fulfilmentDate.slice(0, 10)}`
      );
      for (const li of order.lineItems) {
        lines.push(`  • ${li.quantity}× ${li.productName}`);
      }
    }
  }

  lines.push(``, `## Available Recipes (${ctx.recipes.length})`);
  for (const r of ctx.recipes) {
    lines.push(
      `- **${r.name}** (${r.category}) | Yield: ${r.yieldQuantity} ${r.yieldUnit} | ` +
      `Total time: ${r.totalElapsedMinutes}min | Oven: ${r.ovenMinutes}min | ` +
      `Shelf life: ${r.shelfLifeHours}h | Wastage buffer: ${r.wastageBufferPercent}%`
    );
    lines.push(`  Stages: ${r.stages.map((s) => `${s.name}(${s.durationMinutes}m${s.requiresOven ? " 🔥" : ""})`).join(" → ")}`);
    lines.push(`  Ingredients per batch: ${r.ingredients.map((i) => `${i.name}: ${i.quantityGrams}g`).join(", ")}`);
  }

  lines.push(``, `## Current Stock Levels`);
  for (const s of ctx.stockLevels) {
    const flag = s.alertLevel !== "OK" ? ` ⚠️ ${s.alertLevel}` : "";
    lines.push(`- ${s.name}: **${s.stockGrams}g** (reorder: ${s.reorderThresholdGrams}g)${flag}`);
    for (const exp of s.expiryAlerts) {
      lines.push(`  ⏰ Lot ${exp.lotCode ?? "?"}: ${exp.quantityGrams}g expires in ${exp.expiresIn}`);
    }
  }

  if (ctx.existingBatches.length > 0) {
    lines.push(``, `## Already Scheduled This Shift`);
    for (const b of ctx.existingBatches) {
      lines.push(
        `- ${b.recipeName}: ${b.quantity} units | ` +
        `${b.plannedStartTime.slice(11, 16)}–${b.plannedEndTime.slice(11, 16)} | ` +
        `${b.ovenSlots} oven slot(s)`
      );
    }
  }

  lines.push(``, `Please generate the optimal production schedule for this shift.`);

  return lines.join("\n");
}
