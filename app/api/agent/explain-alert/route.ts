/**
 * POST /api/agent/explain-alert
 *
 * AI provides deeper reasoning and recommended actions for a specific alert.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, notFound, serverError, validationError, requireAuth } from "@/lib/api-helpers";

export const maxDuration = 20;

let _openai: any = null;
function getOpenAI() {
  if (!_openai) {
    const OpenAI = require("openai").default;
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const ExplainSchema = z.object({
  alertId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER", "PURCHASING_MANAGER"]);
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = ExplainSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const alert = await db.agentAlert.findFirst({
      where: { id: parsed.data.alertId, bakeryId: session!.user.bakeryId },
    });
    if (!alert) return notFound("Alert");

    let relatedContext = "";
    if (alert.relatedEntityId && alert.relatedEntityType === "Ingredient") {
      const ingredient = await db.ingredient.findUnique({
        where: { id: alert.relatedEntityId },
        include: { supplier: { select: { name: true, leadTimeDays: true } } },
      });
      if (ingredient) {
        relatedContext = `\nRelated ingredient: ${ingredient.name}\nCurrent stock: ${(Number(ingredient.stockGrams) / 1000).toFixed(2)} kg\nReorder threshold: ${(Number(ingredient.reorderThresholdGrams) / 1000).toFixed(2)} kg\nCritical threshold: ${(Number(ingredient.criticalThresholdGrams) / 1000).toFixed(2)} kg\nSupplier: ${ingredient.supplier?.name ?? "None"} (${ingredient.supplier?.leadTimeDays ?? "?"} day lead time)`;
      }
    }

    const upcomingOrders = await db.order.count({
      where: {
        bakeryId: session!.user.bakeryId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are BakeSync's alert reasoning AI. Explain alerts clearly and recommend specific actions. Be concise — max 3 sentences for explanation, max 3 action items. Return JSON: { "explanation": "why this alert matters and what caused it", "impact": "what happens if ignored", "actions": ["action 1", "action 2", "action 3"], "priority": "IMMEDIATE|TODAY|THIS_WEEK" }`,
        },
        {
          role: "user",
          content: `Alert: ${alert.title}\nSeverity: ${alert.severity}\nMessage: ${alert.message}\nType: ${alert.type}\nPending orders: ${upcomingOrders}${relatedContext}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = { explanation: content, impact: "Unable to assess", actions: [], priority: "TODAY" };
    }

    await db.agentAlert.update({
      where: { id: alert.id },
      data: { isRead: true },
    });

    return ok(result);
  } catch (err) {
    return serverError(err);
  }
}
