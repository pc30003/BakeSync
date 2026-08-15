/**
 * POST /api/agent/run
 *
 * Processes a PENDING GENERATE_SCHEDULE AgentAction end-to-end:
 *   1. Validates the action belongs to the calling bakery
 *   2. Marks it RUNNING
 *   3. Builds the bakery context snapshot
 *   4. Calls the OpenAI planner
 *   5. Writes the resulting schedule + checklists + shortfalls to the DB
 *   6. Returns the AgentRunResult
 *
 * This route is called:
 *   - Directly from POST /api/schedules (synchronous, waits for completion)
 *   - Can also be called by a future background job queue (just POST with actionId)
 *
 * Role guard: HEAD_BAKER only.
 * Timeout: Up to 60s — Next.js Edge is NOT used here (requires Node runtime
 *           for Prisma + OpenAI). Set maxDuration in route config below.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, notFound, serverError, validationError, requireAuth, error } from "@/lib/api-helpers";
import { buildAgentContext } from "@/lib/agent/context-builder";
import { runPlanner }        from "@/lib/agent/planner";
import { writeSchedule }     from "@/lib/agent/schedule-writer";
import type { AgentShiftType } from "@/lib/agent/types";

// Allow up to 60 seconds for the full LLM round-trip
export const maxDuration = 60;

const RunAgentSchema = z.object({
  actionId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const body   = await req.json();
    const parsed = RunAgentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const bakeryId = session!.user.bakeryId;

    // ── 1. Load and validate the AgentAction ──────────────────────────────
    const action = await db.agentAction.findFirst({
      where: {
        id:       parsed.data.actionId,
        bakeryId,
        type:     "GENERATE_SCHEDULE",
        status:   { in: ["PENDING", "FAILED"] }, // allow retry on failed
      },
    });

    if (!action) {
      return notFound("Agent action (must be a PENDING or FAILED GENERATE_SCHEDULE action belonging to your bakery)");
    }

    const details = action.details as {
      scheduleDate: string;
      shiftType: string;
    };

    if (!details?.scheduleDate || !details?.shiftType) {
      return error("Agent action is missing scheduleDate or shiftType in details", 400);
    }

    // ── 2. Mark as RUNNING ─────────────────────────────────────────────────
    await db.agentAction.update({
      where: { id: action.id },
      data:  { status: "RUNNING" },
    });

    const startedAt  = new Date();
    const targetDate = new Date(details.scheduleDate);
    const shiftType  = details.shiftType as AgentShiftType;

    // ── 3. Build context ───────────────────────────────────────────────────
    const context = await buildAgentContext(bakeryId, targetDate, shiftType);

    // ── 4. Run the planner ─────────────────────────────────────────────────
    const plan = await runPlanner(context);

    // ── 5. Write to database ───────────────────────────────────────────────
    const result = await writeSchedule(context, plan, action.id, startedAt);

    return ok(result);

  } catch (err) {
    return serverError(err);
  }
}
