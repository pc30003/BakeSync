/**
 * lib/agent/enqueue.ts
 *
 * Convenience helpers to add tasks to the TaskQueue.
 * Import this anywhere in API routes or server components.
 *
 * Usage:
 *   import { enqueue } from "@/lib/agent/enqueue";
 *   await enqueue.monitorBakery(bakeryId);
 *   await enqueue.generateSchedule(bakeryId, "2026-08-15", "MORNING");
 *   await enqueue.recomputeStock(bakeryId);
 */

import { db } from "@/lib/db";
import type { AgentShiftType } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesFromNow(m: number): Date {
  return new Date(Date.now() + m * 60_000);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const enqueue = {

  /** Run the full monitoring pipeline for one bakery. */
  async monitorBakery(bakeryId: string, delayMinutes = 0) {
    return db.taskQueue.create({
      data: {
        bakeryId,
        type:         "MONITOR_BAKERY",
        priority:     3,
        scheduledFor: minutesFromNow(delayMinutes),
        payload:      {},
      },
    });
  },

  /** Generate an AI production schedule for a specific date + shift. */
  async generateSchedule(
    bakeryId:     string,
    scheduleDate: string,       // "YYYY-MM-DD"
    shiftType:    AgentShiftType,
    delayMinutes  = 0,
    priority      = 2,
  ) {
    return db.taskQueue.create({
      data: {
        bakeryId,
        type:         "GENERATE_SCHEDULE",
        priority,
        scheduledFor: minutesFromNow(delayMinutes),
        payload:      { scheduleDate, shiftType },
      },
    });
  },

  /** Retry a specific failed AgentAction. */
  async retryAction(bakeryId: string, actionId: string) {
    return db.taskQueue.create({
      data: {
        bakeryId,
        type:         "RETRY_FAILED_ACTION",
        priority:     1,           // highest — retries are urgent
        scheduledFor: new Date(),
        payload:      { actionId },
      },
    });
  },

  /** Recompute alertLevel on all ingredients so UI badges are accurate. */
  async recomputeStock(bakeryId: string, delayMinutes = 0) {
    return db.taskQueue.create({
      data: {
        bakeryId,
        type:         "RECOMPUTE_STOCK_ALERTS",
        priority:     5,
        scheduledFor: minutesFromNow(delayMinutes),
        payload:      {},
      },
    });
  },

  /** Queue daily alert digest for head baker. */
  async alertDigest(bakeryId: string) {
    return db.taskQueue.create({
      data: {
        bakeryId,
        type:         "SEND_ALERT_DIGEST",
        priority:     7,
        scheduledFor: new Date(),
        payload:      {},
      },
    });
  },

  /**
   * Seed all recurring tasks for a bakery.
   * Called during onboarding and after database migrations.
   */
  async seedRecurring(bakeryId: string) {
    await db.taskQueue.createMany({
      data: [
        {
          bakeryId,
          type:         "MONITOR_BAKERY",
          priority:     3,
          scheduledFor: new Date(),
          payload:      { reason: "seed_recurring" },
        },
        {
          bakeryId,
          type:         "RECOMPUTE_STOCK_ALERTS",
          priority:     5,
          scheduledFor: new Date(),
          payload:      { reason: "seed_recurring" },
        },
      ],
      skipDuplicates: false,
    });
  },
};
