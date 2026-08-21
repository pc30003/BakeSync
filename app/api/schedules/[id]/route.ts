/**
 * GET   /api/schedules/[id]   — fetch a single schedule with full batch detail
 * PATCH /api/schedules/[id]   — approve or revoke a schedule
 *
 * When a schedule is APPROVED the agent automatically:
 *   1. Deducts ingredient stock for every batch (quantity × scaleFactor × wastageBuffer)
 *   2. Recomputes alert levels on all affected ingredients
 *   3. Creates ProcurementRecommendations for any ingredient that goes LOW/CRITICAL
 *   4. Fires AgentAlerts for CRITICAL shortfalls
 *   5. Logs an AgentAction recording every deduction made
 *
 * When a schedule is REVOKED the stock deductions are NOT reversed
 * (they are already consumed). A note is added to aiNotes.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok, notFound, serverError, validationError, requireAuth, error,
} from "@/lib/api-helpers";

const ApproveSchema = z.object({
  approved: z.boolean(),
});

// ─── GET /api/schedules/[id] ──────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const schedule = await db.productionSchedule.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
      include: {
        batches: {
          include: {
            recipe:        { include: { stages: { orderBy: { order: "asc" } } } },
            checklist:     { orderBy: { order: "asc" } },
            assignedStaff: true,
          },
          orderBy: { plannedStartTime: "asc" },
        },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!schedule) return notFound("Schedule");
    return ok(schedule);
  } catch (err) {
    return serverError(err);
  }
}

// ─── PATCH /api/schedules/[id] ────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, response } = await requireAuth(["HEAD_BAKER"]);
  if (response) return response;

  try {
    const body   = await req.json();
    const parsed = ApproveSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const bakeryId = session!.user.bakeryId;

    const existing = await db.productionSchedule.findFirst({
      where: { id: params.id, bakeryId },
      include: {
        batches: {
          include: {
            recipe: {
              include: {
                ingredients: {
                  include: { ingredient: true },
                },
              },
            },
          },
        },
      },
    });
    if (!existing) return notFound("Schedule");

    // ── Approve ───────────────────────────────────────────────────────────
    if (parsed.data.approved) {
      if (existing.isApproved) {
        return error("Schedule is already approved.", 409);
      }

      // Approve the schedule — stock deduction now happens per checklist step
      const approved = await db.productionSchedule.update({
        where: { id: params.id },
        data: {
          isApproved:   true,
          approvedById: session!.user.id,
          approvedAt:   new Date(),
        },
        include: { approvedBy: { select: { id: true, name: true } } },
      });

      // Log the approval as an AgentAction
      await db.agentAction.create({
        data: {
          bakeryId,
          type:    "GENERATE_SCHEDULE",
          status:  "COMPLETED",
          summary: `Schedule approved by ${session!.user.name ?? session!.user.email}. Stock will be deducted as staff complete each checklist step.`,
          details: { scheduleId: params.id, approvedBy: session!.user.name },
          requiresApproval: false,
          completedAt:      new Date(),
        },
      });

      return ok({
        schedule: approved,
        message:  "Schedule approved. Stock will be deducted as checklist steps are completed.",
      });

    // ── Revoke ─────────────────────────────────────────────────────────────
    } else {
      // Reset all checklist items back to PENDING
      await db.checklistItem.updateMany({
        where: {
          batch: { scheduleId: params.id },
          status: { in: ["DONE", "IN_PROGRESS"] },
        },
        data: {
          status:        "PENDING",
          completedById: null,
          completedAt:   null,
        },
      });

      // Reset batch statuses back to SCHEDULED
      await db.productionBatch.updateMany({
        where: { scheduleId: params.id },
        data: { status: "SCHEDULED" },
      });

      const revoked = await db.productionSchedule.update({
        where: { id: params.id },
        data: {
          isApproved:   false,
          approvedById: null,
          approvedAt:   null,
        },
      });

      return ok({
        schedule: revoked,
        message:  "Schedule revoked. All checklist progress has been reset.",
      });
    }

  } catch (err) {
    return serverError(err);
  }
}
