/**
 * POST /api/agent/smart-procurement
 *
 * AI reasons about upcoming demand, lead times, and stock to generate
 * intelligent procurement recommendations with explanations.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, requireAuth } from "@/lib/api-helpers";
import { addDays } from "date-fns";

export const maxDuration = 30;

let _openai: any = null;
function getOpenAI() {
  if (!_openai) {
    const OpenAI = require("openai").default;
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER", "PURCHASING_MANAGER"]);
  if (response) return response;

  try {
    const bakeryId = session!.user.bakeryId;
    const now = new Date();
    const nextWeek = addDays(now, 7);

    // Get current stock levels
    const ingredients = await db.ingredient.findMany({
      where: { bakeryId, isTracked: true },
      include: { supplier: { select: { name: true, leadTimeDays: true } } },
    });

    // Get upcoming orders
    const upcomingOrders = await db.order.findMany({
      where: {
        bakeryId,
        status: { in: ["PENDING", "CONFIRMED"] },
        fulfilmentDate: { lte: nextWeek },
      },
      include: { lineItems: true },
    });

    // Get recipes to understand demand
    const recipes = await db.recipe.findMany({
      where: { bakeryId, isActive: true },
      include: { ingredients: { include: { ingredient: { select: { name: true } } } } },
    });

    const context = {
      ingredients: ingredients.map(i => ({
        name: i.name,
        stockKg: (Number(i.stockGrams) / 1000).toFixed(2),
        reorderKg: (Number(i.reorderThresholdGrams) / 1000).toFixed(2),
        alertLevel: i.alertLevel,
        supplier: i.supplier?.name ?? "No supplier",
        leadTimeDays: i.supplier?.leadTimeDays ?? 0,
        costPerKg: Number(i.costPerKg),
      })),
      upcomingOrders: upcomingOrders.length,
      orderItems: upcomingOrders.flatMap(o => o.lineItems.map(li => ({
        product: li.productName,
        quantity: li.quantity,
        dueDate: o.fulfilmentDate.toISOString().slice(0, 10),
      }))),
    };

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      temperature: 0.2,
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are BakeSync's procurement AI. Analyze stock levels, upcoming demand, and supplier lead times to recommend what to order NOW to avoid disruption. Be proactive — flag things that will run out BEFORE they hit critical. Return JSON: { "summary": "1-2 sentence overview", "recommendations": [{ "ingredient": "name", "urgency": "CRITICAL|HIGH|MEDIUM|LOW", "reason": "why order now", "suggestedQuantityKg": number, "estimatedCost": number, "supplier": "name", "orderBy": "date string — when to order by to arrive on time" }], "riskAlert": "biggest supply risk in next 7 days" }`,
        },
        {
          role: "user",
          content: `Current bakery state:\n\n${JSON.stringify(context, null, 2)}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: content, recommendations: [], riskAlert: "Unable to parse" };
    }

    // Record as agent action
    await db.agentAction.create({
      data: {
        bakeryId,
        type: "PROCUREMENT_RECOMMENDATION",
        status: "COMPLETED",
        summary: `Smart procurement analysis: ${parsed.recommendations?.length ?? 0} recommendations`,
        details: parsed,
        completedAt: new Date(),
      },
    });

    return ok(parsed);
  } catch (err) {
    return serverError(err);
  }
}
