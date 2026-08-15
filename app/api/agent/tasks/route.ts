/**
 * GET/POST /api/agent/tasks
 *
 * The continuous task queue worker.
 * Called by Vercel Cron every 5 minutes (see vercel.json).
 * Also callable manually with ?type=TASK_TYPE to run a specific task type.
 *
 * How it works:
 *   1. Atomically claims the next N pending tasks (highest priority first,
 *      oldest scheduledFor first) by setting status = RUNNING.
 *   2. Executes each task type via its dedicated handler.
 *   3. Marks tasks COMPLETED or FAILED with full error context.
 *   4. Self-heals: tasks that have been RUNNING for >5 min are reset to PENDING
 *      (handles crashed workers / Vercel cold-starts).
 *   5. Returns a summary of everything that ran.
 *
 * Task types handled:
 *   MONITOR_BAKERY           → runs the full monitoring pipeline for one bakery
 *   GENERATE_SCHEDULE        → runs AI schedule generation for a date + shift
 *   RETRY_FAILED_ACTION      → re-runs a specific failed AgentAction by ID
 *   SEND_ALERT_DIGEST        → compiles and logs a daily summary of alerts
 *   RECOMPUTE_STOCK_ALERTS   → recalculates alertLevel on all ingredients
 *
 * Auth: x-cron-secret header OR any authenticated session.
 */

import { NextRequest }  from "next/server";
import { db }           from "@/lib/db";
import { ok } from "@/lib/api-helpers";
import { auth }         from "@/lib/auth";
import { buildAgentContext } from "@/lib/agent/context-builder";
import { runPlanner }        from "@/lib/agent/planner";
import { writeSchedule }     from "@/lib/agent/schedule-writer";
import type { AgentShiftType } from "@/lib/agent/types";
import { subMinutes } from "date-fns";

export const maxDuration = 60;

// Maximum tasks to process in one invocation (keeps us under Vercel's 60s limit)
const BATCH_SIZE = 10;

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function isAuthorised(req: NextRequest): Promise<boolean> {
  const secret = req.headers.get("x-cron-secret");
  if (secret && secret === process.env.CRON_SECRET) return true;
  const session = await auth().catch(() => null);
  return !!session?.user;
}

export async function GET(req: NextRequest)  { return worker(req); }
export async function POST(req: NextRequest) { return worker(req); }

// ─── Main worker ─────────────────────────────────────────────────────────────

async function worker(req: NextRequest) {
  if (!(await isAuthorised(req))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type") ?? undefined;
  const now = new Date();

  // ── Step 1: Reset stale RUNNING tasks (crashed workers) ──────────────────
  const staleThreshold = subMinutes(now, 5);
  const staleCount = await db.taskQueue.updateMany({
    where: {
      status:    "RUNNING",
      startedAt: { lt: staleThreshold },
      attempts:  { lt: 3 },
    },
    data: {
      status:       "PENDING",
      scheduledFor: now,         // retry immediately
    },
  });

  // ── Step 2: Claim next batch atomically ───────────────────────────────────
  // Use a raw update-then-select pattern to avoid race conditions
  // across multiple worker invocations.
  const claimed = await db.$transaction(async (tx) => {
    const candidates = await tx.taskQueue.findMany({
      where: {
        status:       "PENDING",
        scheduledFor: { lte: now },
        attempts:     { lt: 3 },
        ...(typeFilter ? { type: typeFilter as any } : {}),
      },
      orderBy: [
        { priority:     "asc" },  // 1 = highest priority
        { scheduledFor: "asc" },  // oldest first
      ],
      take: BATCH_SIZE,
    });

    if (candidates.length === 0) return [];

    const ids = candidates.map(t => t.id);

    await tx.taskQueue.updateMany({
      where: { id: { in: ids } },
      data:  { status: "RUNNING", startedAt: now, attempts: { increment: 1 } },
    });

    return candidates;
  });

  if (claimed.length === 0) {
    return ok({
      ranAt:       now.toISOString(),
      processed:   0,
      staleReset:  staleCount.count,
      message:     "No pending tasks.",
    });
  }

  // ── Step 3: Execute each task ─────────────────────────────────────────────
  const results: Array<{
    taskId:   string;
    type:     string;
    bakeryId: string;
    status:   "completed" | "failed";
    message:  string;
    ms:       number;
  }> = [];

  await Promise.allSettled(
    claimed.map(async (task) => {
      const start = Date.now();
      try {
        const message = await executeTask(task);
        await db.taskQueue.update({
          where: { id: task.id },
          data: {
            status:      "COMPLETED",
            completedAt: new Date(),
          },
        });
        results.push({
          taskId:   task.id,
          type:     task.type,
          bakeryId: task.bakeryId,
          status:   "completed",
          message,
          ms:       Date.now() - start,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const attempts     = task.attempts + 1;
        const maxAttempts  = task.maxAttempts;

        // Exponential back-off: 5m, 25m, 2h
        const backoffMinutes = [5, 25, 120][Math.min(attempts - 1, 2)];
        const nextRun = new Date(Date.now() + backoffMinutes * 60 * 1000);

        await db.taskQueue.update({
          where: { id: task.id },
          data: {
            status:       attempts >= maxAttempts ? "FAILED" : "PENDING",
            errorMessage,
            scheduledFor: attempts >= maxAttempts ? undefined : nextRun,
            completedAt:  attempts >= maxAttempts ? new Date() : undefined,
          },
        });

        results.push({
          taskId:   task.id,
          type:     task.type,
          bakeryId: task.bakeryId,
          status:   "failed",
          message:  errorMessage,
          ms:       Date.now() - start,
        });
      }
    })
  );

  const completed = results.filter(r => r.status === "completed").length;
  const failed    = results.filter(r => r.status === "failed").length;

  return ok({
    ranAt:      now.toISOString(),
    processed:  claimed.length,
    completed,
    failed,
    staleReset: staleCount.count,
    results,
  });
}

// ─── Task executors ───────────────────────────────────────────────────────────

async function executeTask(task: {
  id:       string;
  bakeryId: string;
  type:     string;
  payload:  unknown;
}): Promise<string> {
  const payload = (task.payload ?? {}) as Record<string, unknown>;

  switch (task.type) {

    // ── MONITOR_BAKERY ───────────────────────────────────────────────────────
    case "MONITOR_BAKERY": {
      // Delegate to the monitor logic (import to avoid duplication)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/agent/monitor`,
        {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "x-cron-secret": process.env.CRON_SECRET ?? "",
            // Pass bakery scope via header so monitor runs only this bakery
            "x-bakery-id":   task.bakeryId,
          },
        }
      );
      if (!res.ok) throw new Error(`Monitor HTTP ${res.status}`);
      const json = await res.json();
      const r    = json.data?.results?.[0];
      return r
        ? `Monitor: ${r.totalActionsLogged} actions, ${r.healed ?? 0} healed`
        : "Monitor completed";
    }

    // ── GENERATE_SCHEDULE ────────────────────────────────────────────────────
    case "GENERATE_SCHEDULE": {
      const scheduleDate = payload.scheduleDate as string;
      const shiftType    = payload.shiftType    as AgentShiftType;
      if (!scheduleDate || !shiftType) throw new Error("Missing scheduleDate or shiftType in payload");

      const targetDate = new Date(scheduleDate);

      // Create tracking AgentAction
      const action = await db.agentAction.create({
        data: {
          bakeryId:         task.bakeryId,
          type:             "GENERATE_SCHEDULE",
          status:           "RUNNING",
          summary:          `Queue-triggered: generate ${shiftType} schedule for ${scheduleDate}`,
          details:          { scheduleDate, shiftType, taskId: task.id },
          requiresApproval: false,
        },
      });

      const startedAt = new Date();
      const context   = await buildAgentContext(task.bakeryId, targetDate, shiftType);
      const plan      = await runPlanner(context);
      const result    = await writeSchedule(context, plan, action.id, startedAt);

      return `Schedule generated: ${plan.batches.length} batches, ${result.shortfalls.length} shortfalls`;
    }

    // ── RETRY_FAILED_ACTION ──────────────────────────────────────────────────
    case "RETRY_FAILED_ACTION": {
      const actionId = payload.actionId as string;
      if (!actionId) throw new Error("Missing actionId in payload");

      const action = await db.agentAction.findFirst({
        where: { id: actionId, bakeryId: task.bakeryId, status: { in: ["FAILED", "PENDING"] } },
      });
      if (!action) throw new Error(`AgentAction ${actionId} not found or not retryable`);

      const details = action.details as { scheduleDate?: string; shiftType?: string };

      if (action.type === "GENERATE_SCHEDULE" && details.scheduleDate && details.shiftType) {
        await db.agentAction.update({ where: { id: actionId }, data: { status: "RUNNING" } });

        const context = await buildAgentContext(
          task.bakeryId,
          new Date(details.scheduleDate),
          details.shiftType as AgentShiftType
        );
        const plan   = await runPlanner(context);
        await writeSchedule(context, plan, actionId, new Date());
        return `Retried AgentAction ${actionId} — schedule generated`;
      }

      throw new Error(`Cannot retry action type: ${action.type}`);
    }

    // ── RECOMPUTE_STOCK_ALERTS ───────────────────────────────────────────────
    case "RECOMPUTE_STOCK_ALERTS": {
      // Re-evaluate alertLevel for every tracked ingredient in this bakery.
      // This runs every 15 min so the sidebar badges are always accurate.
      const ingredients = await db.ingredient.findMany({
        where: { bakeryId: task.bakeryId, isTracked: true },
        select: { id: true, stockGrams: true, reorderThresholdGrams: true, criticalThresholdGrams: true },
      });

      let updated = 0;
      for (const ing of ingredients) {
        const stock    = Number(ing.stockGrams);
        const critical = Number(ing.criticalThresholdGrams);
        const reorder  = Number(ing.reorderThresholdGrams);
        const level    = stock <= 0 ? "OUT_OF_STOCK" : stock <= critical ? "CRITICAL" : stock <= reorder ? "LOW" : "OK";

        await db.ingredient.update({
          where: { id: ing.id },
          data:  { alertLevel: level },
        });
        updated++;
      }

      return `Recomputed alert levels for ${updated} ingredients`;
    }

    // ── SEND_ALERT_DIGEST ────────────────────────────────────────────────────
    case "SEND_ALERT_DIGEST": {
      // Compile a daily summary of all unread alerts and log it as an AgentAction.
      // (Email delivery would go here via Resend once RESEND_API_KEY is set.)
      const alerts = await db.agentAlert.findMany({
        where: {
          bakeryId:    task.bakeryId,
          isDismissed: false,
          isRead:      false,
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      });

      const critical = alerts.filter(a => a.severity === "CRITICAL").length;
      const warnings = alerts.filter(a => a.severity === "WARNING").length;
      const info     = alerts.filter(a => a.severity === "INFO").length;

      const digestSummary = alerts.length === 0
        ? "All clear — no active alerts"
        : `${critical} critical · ${warnings} warnings · ${info} info`;

      // Log the digest as an AgentAction so it appears in the activity feed
      await db.agentAction.create({
        data: {
          bakeryId:         task.bakeryId,
          type:             "WASTE_ALERT",
          status:           "COMPLETED",
          summary:          `Daily alert digest: ${digestSummary}`,
          details: {
            total:    alerts.length,
            critical, warnings, info,
            topAlerts: alerts.slice(0, 5).map(a => ({
              severity: a.severity,
              title:    a.title,
            })),
            digestAt: new Date().toISOString(),
          },
          requiresApproval: false,
          completedAt:      new Date(),
        },
      });

      // TODO: send via Resend when RESEND_API_KEY is configured
      // import { Resend } from "resend";
      // const resend = new Resend(process.env.RESEND_API_KEY);
      // await resend.emails.send({ from: ..., to: headBakerEmail, subject: "BakeSync Daily Digest", html: ... });

      return `Digest compiled: ${digestSummary}`;
    }

    default:
      throw new Error(`Unknown task type: ${task.type}`);
  }
}
