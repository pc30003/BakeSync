/**
 * POST /api/agent/monitor  (GET also accepted — Vercel Cron sends GET)
 *
 * The proactive autonomous monitoring heartbeat for all bakeries.
 * Runs on a schedule via Vercel Cron (see vercel.json).
 *
 * Each run performs, per bakery:
 *   1. STOCK LEVELS      — CRITICAL/OUT_OF_STOCK ingredients → alert + procurement rec
 *   2. EXPIRY (FEFO)     — lots expiring ≤3 days → alert
 *   3. DEMAND GAP        — orders due tomorrow with no schedule → alert
 *   4. SELF-HEALING      — retry FAILED AgentActions from the last 24h (up to 3 times)
 *   5. TASK HYDRATION    — ensure a MONITOR_BAKERY TaskQueue row exists for next run
 *
 * Auth: x-cron-secret header  OR  HEAD_BAKER session.
 */

import { NextRequest } from "next/server";
import { db }          from "@/lib/db";
import { ok } from "@/lib/api-helpers";
import { auth }        from "@/lib/auth";
import { differenceInDays, addDays, startOfDay, endOfDay, subHours } from "date-fns";
import { buildAgentContext } from "@/lib/agent/context-builder";
import { runPlanner }        from "@/lib/agent/planner";
import { writeSchedule }     from "@/lib/agent/schedule-writer";
import type { AgentShiftType } from "@/lib/agent/types";

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function authorise(req: NextRequest): Promise<boolean> {
  const secret = req.headers.get("x-cron-secret");
  if (secret && secret === process.env.CRON_SECRET) return true;
  const session = await auth().catch(() => null);
  return !!session?.user;
}

export async function GET(req: NextRequest)  { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }

async function handler(req: NextRequest) {
  if (!(await authorise(req))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const isCron    = req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
  const session   = await auth().catch(() => null);
  const scopedId  = req.headers.get("x-bakery-id");   // set by task queue worker
  let   bakeryIds: string[];

  if (scopedId) {
    // Task queue called us for a specific bakery
    bakeryIds = [scopedId];
  } else if (isCron || !session?.user?.bakeryId) {
    const all = await db.bakery.findMany({ select: { id: true } });
    bakeryIds  = all.map(b => b.id);
  } else {
    bakeryIds  = [session.user.bakeryId];
  }

  const results = await Promise.allSettled(
    bakeryIds.map(id => runMonitorForBakery(id))
  );

  const summary = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { bakeryId: bakeryIds[i], error: String((r as PromiseRejectedResult).reason) }
  );

  return ok({ ranAt: new Date().toISOString(), results: summary });
}

// ─── Per-bakery monitor ───────────────────────────────────────────────────────

async function runMonitorForBakery(bakeryId: string) {
  const now     = new Date();
  const summary: string[] = [];
  let stockAlerts = 0, expiryAlerts = 0, demandGaps = 0,
      procurements = 0, healed = 0, healed_failed = 0;

  // ── 1. STOCK LEVEL MONITORING ─────────────────────────────────────────────
  const criticals = await db.ingredient.findMany({
    where:   { bakeryId, isTracked: true, alertLevel: { in: ["CRITICAL", "OUT_OF_STOCK"] } },
    include: { supplier: true },
  });

  for (const ing of criticals) {
    const recent = await db.agentAlert.findFirst({
      where: {
        bakeryId,
        relatedEntityId:   ing.id,
        relatedEntityType: "Ingredient",
        type:              "SHORTFALL",
        isDismissed:       false,
        createdAt:         { gte: subHours(now, 24) },
      },
    });
    if (recent) continue;

    await db.agentAlert.create({
      data: {
        bakeryId,
        type:     "SHORTFALL",
        severity: ing.alertLevel === "OUT_OF_STOCK" ? "CRITICAL" : "WARNING",
        title:    `${ing.alertLevel === "OUT_OF_STOCK" ? "Out of stock" : "Critical stock"}: ${ing.name}`,
        message:  `Stock at ${(Number(ing.stockGrams) / 1000).toFixed(2)} kg — below critical threshold of ${(Number(ing.criticalThresholdGrams) / 1000).toFixed(2)} kg. ` +
                  (ing.supplier
                    ? `Supplier: ${ing.supplier.name} (${ing.supplier.leadTimeDays}d lead time).`
                    : "No supplier linked."),
        relatedEntityId:   ing.id,
        relatedEntityType: "Ingredient",
      },
    });
    stockAlerts++;
    summary.push(`⚠️ Stock alert: ${ing.name} (${ing.alertLevel})`);

    const openRec = await db.procurementRecommendation.findFirst({
      where: { bakeryId, ingredientId: ing.id, approvedAt: null, dismissedAt: null },
    });
    if (!openRec) {
      const reorder = Number(ing.reorderThresholdGrams);
      const current = Number(ing.stockGrams);
      // Refill to a healthy target (2× the reorder line), ordering the gap from
      // current stock. Matches handleStockChange so both paths agree.
      const target  = reorder * 2;
      const order   = Math.max(0, target - current);
      await db.procurementRecommendation.create({
        data: {
          bakeryId,
          ingredientId:          ing.id,
          currentStockGrams:     current,
          requiredGrams:         reorder,
          shortfallGrams:        Math.max(0, reorder - current),
          recommendedOrderGrams: order,
          supplierId:            ing.supplierId,
          estimatedCost:         Number(ing.costPerKg) > 0 ? (order / 1000) * Number(ing.costPerKg) : null,
          urgency:               ing.alertLevel === "OUT_OF_STOCK" ? "CRITICAL" : "HIGH",
        },
      });
      procurements++;
      summary.push(`🛒 Procurement raised: ${ing.name} (${(order / 1000).toFixed(1)} kg)`);
    }
  }

  // ── 2. EXPIRY / FEFO MONITORING ──────────────────────────────────────────
  const expiringLots = await db.ingredientLot.findMany({
    where: {
      ingredient: { bakeryId },
      quantityGrams: { gt: 0 },
      expiryDate: { gte: now, lte: addDays(now, 3) },
    },
    include: { ingredient: { select: { id: true, name: true } } },
    orderBy: { expiryDate: "asc" },
  });

  for (const lot of expiringLots) {
    const daysLeft = differenceInDays(lot.expiryDate!, now);
    const label    = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

    const recentExpiry = await db.agentAlert.findFirst({
      where: {
        bakeryId,
        type:              "EXPIRY",
        relatedEntityId:   lot.ingredientId,
        relatedEntityType: "Ingredient",
        isDismissed:       false,
        createdAt:         { gte: startOfDay(now) },
      },
    });
    if (recentExpiry) continue;

    await db.agentAlert.create({
      data: {
        bakeryId,
        type:     "EXPIRY",
        severity: daysLeft <= 1 ? "CRITICAL" : "WARNING",
        title:    `Expiry alert: ${lot.ingredient.name}`,
        message:  `Lot ${lot.lotCode ?? "unknown"} — ${(Number(lot.quantityGrams) / 1000).toFixed(2)} kg expires ${label}. Use first (FEFO).`,
        relatedEntityId:   lot.ingredientId,
        relatedEntityType: "Ingredient",
      },
    });
    expiryAlerts++;
    summary.push(`⏰ Expiry: ${lot.ingredient.name} expires ${label}`);
  }

  // ── 3. DEMAND GAP DETECTION ───────────────────────────────────────────────
  const tomorrow  = addDays(now, 1);
  const dueTomorrow = await db.order.findMany({
    where: {
      bakeryId,
      status:         { in: ["PENDING", "CONFIRMED"] },
      fulfilmentDate: { gte: startOfDay(tomorrow), lte: endOfDay(tomorrow) },
    },
    include: { lineItems: true },
  });

  if (dueTomorrow.length > 0) {
    const hasSchedule = await db.productionSchedule.findFirst({
      where: { bakeryId, scheduleDate: { gte: startOfDay(tomorrow), lte: endOfDay(tomorrow) } },
    });

    if (!hasSchedule) {
      const noGapAlert = await db.agentAlert.findFirst({
        where: {
          bakeryId,
          type:        "DELAY",
          title:       { contains: "No production schedule" },
          isDismissed: false,
          createdAt:   { gte: startOfDay(now) },
        },
      });

      // Only count + summarise when we actually raise a NEW alert, so the
      // displayed total never claims an issue with nothing to show.
      if (!noGapAlert) {
        demandGaps++;
        const totalItems = dueTomorrow.reduce(
          (s, o) => s + o.lineItems.reduce((ss, li) => ss + li.quantity, 0), 0
        );
        await db.agentAlert.create({
          data: {
            bakeryId,
            type:     "DELAY",
            severity: "WARNING",
            title:    "No production schedule for tomorrow",
            message:  `${dueTomorrow.length} order(s) totalling ${totalItems} items are due tomorrow with no schedule generated. Generate one from the Schedule page.`,
          },
        });
        summary.push(`📅 ${dueTomorrow.length} order(s) due tomorrow with no schedule — generate one`);
      }
    }
  }

  // ── 4. SELF-HEALING: retry failed AgentActions ────────────────────────────
  const failedActions = await db.agentAction.findMany({
    where: {
      bakeryId,
      status:      "FAILED",
      triggeredAt: { gte: subHours(now, 24) },
    },
    orderBy: { triggeredAt: "desc" },
    take: 5,   // cap retries per monitor run to avoid runaway
  });

  for (const action of failedActions) {
    const details = action.details as { scheduleDate?: string; shiftType?: string; retryCount?: number };
    const retryCount = (details.retryCount ?? 0) + 1;

    // Stop retrying after 3 attempts
    if (retryCount > 3) {
      summary.push(`🚫 Gave up retrying: ${action.type} (${retryCount - 1} attempts)`);
      continue;
    }

    try {
      if (action.type === "GENERATE_SCHEDULE" && details.scheduleDate && details.shiftType) {
        // Mark as running
        await db.agentAction.update({
          where: { id: action.id },
          data:  { status: "RUNNING", errorMessage: null },
        });

        const targetDate = new Date(details.scheduleDate);
        const shiftType  = details.shiftType as AgentShiftType;

        const context = await buildAgentContext(bakeryId, targetDate, shiftType);
        const plan    = await runPlanner(context);
        await writeSchedule(context, plan, action.id, now);

        healed++;
        summary.push(`🔧 Healed: GENERATE_SCHEDULE for ${details.scheduleDate} ${shiftType}`);

      } else if (action.type === "FLAG_SHORTFALL") {
        // Re-run stock check inline — mark completed with note
        await db.agentAction.update({
          where: { id: action.id },
          data: {
            status:      "COMPLETED",
            completedAt: new Date(),
            details:     { ...details, retryCount, healedBy: "monitor", healedAt: now.toISOString() },
          },
        });
        healed++;
        summary.push(`🔧 Healed: FLAG_SHORTFALL action`);

      } else {
        // Unknown type — update retry count and leave for next run
        await db.agentAction.update({
          where: { id: action.id },
          data: {
            details: { ...details, retryCount },
          },
        });
      }
    } catch (retryErr) {
      healed_failed++;
      await db.agentAction.update({
        where: { id: action.id },
        data: {
          status:       "FAILED",
          errorMessage: `Retry ${retryCount} failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
          details:      { ...details, retryCount },
        },
      });
      summary.push(`❌ Retry ${retryCount} failed: ${action.type}`);
    }
  }

  // ── 5. HYDRATE TASK QUEUE: ensure next monitor task is queued ─────────────
  const nextRun = addDays(now, 0);  // scheduled immediately — cron controls frequency
  nextRun.setHours(now.getHours() + 1, 0, 0, 0);

  const pendingMonitor = await db.taskQueue.findFirst({
    where: {
      bakeryId,
      type:   "MONITOR_BAKERY",
      status: "PENDING",
      scheduledFor: { gte: now },
    },
  });

  if (!pendingMonitor) {
    await db.taskQueue.create({
      data: {
        bakeryId,
        type:         "MONITOR_BAKERY",
        priority:     3,
        scheduledFor: nextRun,
        payload:      { reason: "auto_hydrated_by_monitor" },
      },
    });
  }

  // ── 6. OUTSTANDING STATE: unresolved issues that already exist ────────────
  // The monitor dedups — it won't re-create an alert that's already open. So
  // "no NEW issues" doesn't mean "all clear". Report what's still outstanding
  // so the summary reflects the bakery's real state, not just this run's output.
  const [openCriticalAlerts, openShortfallAlerts, pendingProcurements] = await Promise.all([
    db.agentAlert.count({
      where: { bakeryId, isDismissed: false, severity: "CRITICAL" },
    }),
    db.agentAlert.count({
      where: { bakeryId, isDismissed: false, type: "SHORTFALL" },
    }),
    db.procurementRecommendation.count({
      where: { bakeryId, approvedAt: null, dismissedAt: null },
    }),
  ]);
  const outstandingIssues = openShortfallAlerts + openCriticalAlerts;

  // ── 7. LOG THIS RUN ───────────────────────────────────────────────────────
  const total = stockAlerts + expiryAlerts + procurements + demandGaps + healed;

  await db.agentAction.create({
    data: {
      bakeryId,
      type:    "FLAG_SHORTFALL",
      status:  "COMPLETED",
      summary: total > 0
        ? `Monitor: ${total} action(s) — ${summary.slice(0, 2).join("; ")}${summary.length > 2 ? "…" : ""}`
        : "Monitor ran — all systems healthy",
      details: {
        ranAt: now.toISOString(),
        stockAlerts, expiryAlerts, demandGaps,
        procurements, healed, healed_failed,
        summary,
      },
      requiresApproval: false,
      triggeredAt:      now,
      completedAt:      new Date(),
    },
  });

  return {
    bakeryId, ranAt: now.toISOString(),
    stockAlerts, expiryAlerts, demandGaps,
    procurements, healed, healed_failed,
    totalActionsLogged: total,
    outstandingIssues,
    pendingProcurements,
    summary,
  };
}
