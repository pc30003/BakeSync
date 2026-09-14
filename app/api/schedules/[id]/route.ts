/**
 * GET   /api/schedules/[id]   — fetch a single schedule with full batch detail
 * PATCH /api/schedules/[id]   — approve or revoke a schedule
 *
 * Stock model: APPROVING a schedule does NOT deduct stock. Stock is deducted
 * incrementally as floor staff mark each checklist step DONE (see the checklist
 * route) — so the numbers reflect what has actually been made, not just planned.
 *
 * When a schedule is APPROVED:
 *   1. It is marked approved so its checklists become tickable by floor staff.
 *   2. An AgentAction is logged recording the approval.
 *
 * When a schedule is REVOKED:
 *   1. Stock deducted by any completed (DONE) checklist steps is RESTORED.
 *   2. Affected ingredients' alert levels are recomputed.
 *   3. All checklist items reset to PENDING and all batches reset to SCHEDULED.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok, notFound, serverError, validationError, requireAuth, error,
} from "@/lib/api-helpers";
import { computeAlertLevel } from "@/lib/stock-actions";

// PATCH accepts EITHER an approve/revoke toggle { approved: boolean }
// OR a close action { close: true }. Exactly one is acted on per request;
// `close` takes precedence if both are somehow sent.
const ApproveSchema = z.object({
  approved: z.boolean().optional(),
  close:    z.literal(true).optional(),
}).refine((d) => d.approved !== undefined || d.close === true, {
  message: "Provide either { approved: boolean } or { close: true }.",
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
        approvedBy: { select: { name: true } },
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

    // ── Close (finish the production run) ────────────────────────────────────
    // Snapshots the finished run into the immutable ProductionRunHistory archive,
    // then DELETES the live schedule row — which frees the (date, shift) slot so
    // the shift can be run again, and lets completed runs STACK in History.
    // Stock is NOT restored (the ingredients were really consumed) — the
    // deliberate opposite of Revoke.
    if (parsed.data.close === true) {
      if (!existing.isApproved) {
        return error("Only an approved schedule can be closed.", 409);
      }

      // Require every checklist item across every batch to be DONE (or SKIPPED)
      // — you can't finish a run that hasn't actually been made.
      const items = await db.checklistItem.findMany({
        where:  { batch: { scheduleId: params.id } },
        select: { status: true },
      });
      const allDone =
        items.length > 0 &&
        items.every((i) => i.status === "DONE" || i.status === "SKIPPED");
      if (!allDone) {
        return error("All checklist steps must be completed before closing the schedule.", 409);
      }

      await db.$transaction(async (tx) => {
        // 1. Snapshot the run into the immutable history archive (denormalised
        //    text — survives deletion of the live schedule/recipe).
        await tx.productionRunHistory.create({
          data: {
            bakeryId,
            scheduleDate:           existing.scheduleDate,
            shiftType:              existing.shiftType,
            aiNotes:                existing.aiNotes,
            approvedByName:         existing.approvedBy?.name ?? null,
            closedByName:           session!.user.name ?? session!.user.email ?? null,
            ovenUtilizationPercent: existing.totalOvenUtilizationPercent,
            batchCount:             existing.batches.length,
            closedAt:               new Date(),
            batches: {
              create: existing.batches.map((b) => ({
                recipeName:       b.recipe.name,
                recipeCategory:   String(b.recipe.category),
                quantity:         b.quantity,
                scaleFactor:      b.scaleFactor,
                plannedStartTime: b.plannedStartTime,
                plannedEndTime:   b.plannedEndTime,
              })),
            },
          },
        });

        // 2. Delete the live schedule (cascades to batches + checklist items).
        //    Stock stays as-is — nothing is restored. The (date,shift) slot is
        //    now free, so the shift can be generated again.
        await tx.productionSchedule.delete({ where: { id: params.id } });
      });

      await db.agentAction.create({
        data: {
          bakeryId,
          type:    "GENERATE_SCHEDULE",
          status:  "COMPLETED",
          summary: `Production run completed and archived by ${session!.user.name ?? session!.user.email}. Consumed stock retained.`,
          details: { scheduleDate: existing.scheduleDate.toISOString(), closedBy: session!.user.name, action: "close" },
          requiresApproval: false,
          completedAt:      new Date(),
        },
      });

      return ok({
        archived: true,
        message:  "Production run completed and archived. Ingredients used remain deducted; the shift can be scheduled again.",
      });
    }

    // Past this point we're handling the approve/revoke toggle. `approved` is
    // optional in the schema (to allow a { close: true } request), so guard the
    // case where neither a boolean nor close was actionable.
    if (typeof parsed.data.approved !== "boolean") {
      return error("Provide { approved: boolean } or { close: true }.", 422);
    }

    // ── Approve ───────────────────────────────────────────────────────────
    if (parsed.data.approved === true) {
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
      // Guard: if already not approved, nothing to revoke (prevents double-restore)
      if (!existing.isApproved) {
        return error("Schedule is not approved.", 409);
      }

      // Find all DONE checklist items that deducted stock, so we can restore it
      const doneItems = await db.checklistItem.findMany({
        where: {
          batch: { scheduleId: params.id },
          status: "DONE",
        },
        include: { deductions: true },
      });

      // Do the restore + reset atomically so a mid-way failure can't leave
      // stock restored while items stay DONE (which a retry would double-restore).
      const revoked = await db.$transaction(async (tx) => {
        for (const item of doneItems) {
          const restorations: Array<{ ingredientId: string; grams: number }> = [];
          if (item.deductions && item.deductions.length > 0) {
            for (const d of item.deductions) {
              restorations.push({ ingredientId: d.ingredientId, grams: d.deductionGrams });
            }
          } else if (item.ingredientId && item.deductionGrams) {
            restorations.push({ ingredientId: item.ingredientId, grams: item.deductionGrams });
          }

          for (const r of restorations) {
            const ingredient = await tx.ingredient.findUnique({ where: { id: r.ingredientId } });
            if (ingredient) {
              const newStock = Number(ingredient.stockGrams) + r.grams;
              const alertLevel = computeAlertLevel(
                newStock,
                Number(ingredient.criticalThresholdGrams),
                Number(ingredient.reorderThresholdGrams)
              );
              await tx.ingredient.update({
                where: { id: r.ingredientId },
                data:  { stockGrams: newStock, alertLevel },
              });
            }
          }
        }

        // Reset all checklist items back to PENDING
        await tx.checklistItem.updateMany({
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
        await tx.productionBatch.updateMany({
          where: { scheduleId: params.id },
          data: { status: "SCHEDULED" },
        });

        return tx.productionSchedule.update({
          where: { id: params.id },
          data: {
            isApproved:   false,
            approvedById: null,
            approvedAt:   null,
          },
        });
      });

      return ok({
        schedule: revoked,
        message:  "Schedule revoked. Checklist progress reset and deducted ingredients restored.",
      });
    }

  } catch (err) {
    return serverError(err);
  }
}
