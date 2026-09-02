/**
 * POST /api/agent/analyze-wastage
 *
 * AI analyses recent wastage patterns and returns insights + suggestions.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, requireAuth } from "@/lib/api-helpers";
import { subDays } from "date-fns";

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
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const bakeryId = session!.user.bakeryId;
    const now = new Date();
    const last30 = subDays(now, 30);

    const wastageLogs = await db.wastageLog.findMany({
      where: { bakeryId, shiftDate: { gte: last30 } },
      include: {
        ingredient: { select: { name: true, category: true } },
        loggedBy: { select: { name: true } },
      },
      orderBy: { shiftDate: "desc" },
    });

    if (wastageLogs.length === 0) {
      return ok({
        analysis: "No wastage data recorded in the last 30 days. Start logging wastage to receive AI-powered insights.",
        suggestions: [],
        topIssue: "",
        estimatedSavings: "",
      });
    }

    const wastageContext = wastageLogs.map(log => ({
      ingredient: log.ingredient?.name ?? "Unknown product",
      category: log.ingredient?.category ?? "OTHER",
      grams: Number(log.quantityGrams),
      reason: log.reason,
      date: log.shiftDate.toISOString().slice(0, 10),
      loggedBy: log.loggedBy.name,
    }));

    const totalWasteKg = (wastageContext.reduce((sum, l) => sum + l.grams, 0) / 1000).toFixed(2);

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: `You are BakeSync's wastage analysis AI. Analyze bakery wastage data and provide actionable insights. Be concise and specific. Return JSON with format: { "analysis": "2-3 sentence summary", "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"], "topIssue": "single biggest wastage problem", "estimatedSavings": "estimated monthly savings if top issue is fixed" }`,
        },
        {
          role: "user",
          content: `Analyze this bakery's wastage data from the last 30 days (${wastageLogs.length} entries, ${totalWasteKg} kg total):\n\n${JSON.stringify(wastageContext, null, 2)}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    let parsed;
    try {
      parsed = JSON.parse(extractJson(content));
    } catch {
      parsed = { analysis: content, suggestions: [], topIssue: "Unable to parse", estimatedSavings: "N/A" };
    }

    await db.agentAction.create({
      data: {
        bakeryId,
        type: "WASTE_ALERT",
        status: "COMPLETED",
        summary: `Analyzed ${wastageLogs.length} wastage entries (${totalWasteKg} kg)`,
        details: parsed,
        // Explicit triggeredAt so the displayed duration is real, never negative.
        triggeredAt: now,
        completedAt: new Date(),
      },
    });

    return ok(parsed);
  } catch (err) {
    return serverError(err);
  }
}

/**
 * LLMs often wrap JSON in a markdown code fence (```json … ```), or add a
 * sentence before/after it. Strip the fence and extract the JSON object so
 * JSON.parse doesn't choke on the wrapper.
 */
function extractJson(raw: string): string {
  let s = raw.trim();
  // Remove ```json / ``` fences if present
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // Fall back to the substring between the first { and last }
  const first = s.indexOf("{");
  const last  = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return s.slice(first, last + 1);
  }
  return s;
}
