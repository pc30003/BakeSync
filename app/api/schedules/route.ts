/**
 * GET  /api/schedules  — list schedules (all roles)
 * POST /api/schedules  — generate a schedule via the agent (HEAD_BAKER only)
 *
 * The POST handler creates an AgentAction, then immediately calls the agent
 * worker inline so the caller gets back a fully populated schedule in one
 * request rather than having to poll. The maxDuration is raised to 60s to
 * accommodate the OpenAI round-trip.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, serverError, validationError, requireAuth } from "@/lib/api-helpers";
import { buildAgentContext } from "@/lib/agent/context-builder";
import { runPlanner }        from "@/lib/agent/planner";
import { writeSchedule }     from "@/lib/agent/schedule-writer";
import type { AgentShiftType } from "@/lib/agent/types";

// Raise timeout to accommodate OpenAI call
export const maxDuration = 60;

const GenerateScheduleSchema = z.object({
  scheduleDate:    z.string().datetime(),
  shiftType:       z.enum(["MORNING", "AFTERNOON", "EVENING", "OVERNIGHT"]),
  forceRegenerate: z.boolean().default(false),
});

// ─── GET /api/schedules ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const from     = searchParams.get("from");
    const to       = searchParams.get("to");
    const approved = searchParams.get("approved");

    const schedules = await db.productionSchedule.findMany({
      where: {
        bakeryId: session!.user.bakeryId,
        ...(approved === "true" && { isApproved: true }),
        ...(from || to ? {
          scheduleDate: {
            ...(from && { gte: new Date(from) }),
            ...(to   && { lte: new Date(to)   }),
          },
        } : {}),
      },
      include: {
        batches: {
          include: {
            recipe:    { select: { id: true, name: true, category: true } },
            checklist: { orderBy: { order: "asc" } },
          },
          orderBy: { plannedStartTime: "asc" },
        },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { scheduleDate: "asc" },
    });

    return ok(schedules);
  } catch (err) {
    return serverError(err);
  }
}

// ─── POST /api/schedules ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const body   = await req.json();
    const parsed = GenerateScheduleSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const bakeryId   = session!.user.bakeryId;
    const targetDate = new Date(parsed.data.scheduleDate);
    const shiftType  = parsed.data.shiftType as AgentShiftType;

    // Return existing schedule if already approved and forceRegenerate is false
    if (!parsed.data.forceRegenerate) {
      const existing = await db.productionSchedule.findFirst({
        where: {
          bakeryId,
          scheduleDate: targetDate,
          shiftType,
          isApproved: true,
        },
        include: {
          batches: {
            include: {
              recipe:    { select: { id: true, name: true, category: true } },
              checklist: { orderBy: { order: "asc" } },
            },
            orderBy: { plannedStartTime: "asc" },
          },
        },
      });

      if (existing) {
        return ok({
          schedule:  existing,
          generated: false,
          message:   "Returning existing approved schedule. Pass forceRegenerate: true to rebuild.",
        });
      }
    }

    // ── Create an AgentAction to record this run ───────────────────────────
    const action = await db.agentAction.create({
      data: {
        bakeryId,
        type:    "GENERATE_SCHEDULE",
        status:  "PENDING",
        summary: `Generate ${shiftType} schedule for ${targetDate.toDateString()}`,
        details: {
          scheduleDate: parsed.data.scheduleDate,
          shiftType,
        },
        requiresApproval: false,
      },
    });

    // ── Run the agent inline ───────────────────────────────────────────────
    // Mark running immediately
    await db.agentAction.update({
      where: { id: action.id },
      data:  { status: "RUNNING" },
    });

    const startedAt = new Date();

    // Step 1: Build the full bakery context
    const context = await buildAgentContext(bakeryId, targetDate, shiftType);

    // Step 2: Call OpenAI planner
    const plan = await runPlanner(context);

    // Step 3: Write schedule + checklists + procurement recs to DB
    const result = await writeSchedule(context, plan, action.id, startedAt);

    // Fetch the fully populated schedule to return to the caller
    const schedule = result.scheduleId
      ? await db.productionSchedule.findUnique({
          where: { id: result.scheduleId },
          include: {
            batches: {
              include: {
                recipe:    { select: { id: true, name: true, category: true } },
                checklist: { orderBy: { order: "asc" } },
              },
              orderBy: { plannedStartTime: "asc" },
            },
          },
        })
      : null;

    return ok({
      schedule,
      generated:    true,
      agentResult:  result,
    });

  } catch (err) {
    return serverError(err);
  }
}
