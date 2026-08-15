/**
 * GET /api/agent/status
 *
 * Lightweight endpoint for the demo banner ticker and the Agent Activity page.
 * Returns:
 *  - latest: human-readable description of the most recent agent action
 *  - pendingTasks: count of tasks in the queue waiting to run
 *  - runningTasks: count of tasks currently executing
 *  - completedToday: count of tasks completed in the last 24h
 *  - lastRanAt: ISO timestamp of the most recent completed action
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, requireAuth } from "@/lib/api-helpers";
import { subHours } from "date-fns";

export async function GET(_req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const bakeryId = session!.user.bakeryId;
    const since24h = subHours(new Date(), 24);

    const [latestAction, pendingTasks, runningTasks, completedToday] =
      await Promise.all([
        db.agentAction.findFirst({
          where:   { bakeryId, status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          select:  { summary: true, completedAt: true, type: true },
        }),
        db.taskQueue.count({
          where: { bakeryId, status: "PENDING" },
        }),
        db.taskQueue.count({
          where: { bakeryId, status: "RUNNING" },
        }),
        db.taskQueue.count({
          where: {
            bakeryId,
            status:      "COMPLETED",
            completedAt: { gte: since24h },
          },
        }),
      ]);

    const latest = latestAction
      ? `[${latestAction.type.replace("_", " ")}] ${latestAction.summary}`
      : "Agent standing by…";

    return ok({
      latest,
      pendingTasks,
      runningTasks,
      completedToday,
      lastRanAt: latestAction?.completedAt?.toISOString() ?? null,
    });
  } catch (err) {
    return serverError(err);
  }
}
