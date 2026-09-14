import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, notFound, serverError, validationError, requireAuth, error } from "@/lib/api-helpers";
import { computeAlertLevel, handleStockChange } from "@/lib/stock-actions";

const UpdateChecklistSchema = z.object({
  itemId: z.string(),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"]),
  notes: z.string().nullable().optional(),
});

// PATCH /api/schedules/[id]/batches/[batchId]/checklist — update a checklist item
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; batchId: string } }
) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = UpdateChecklistSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const item = await db.checklistItem.findFirst({
      where: { id: parsed.data.itemId, batchId: params.batchId },
      include: {
        batch: { include: { schedule: { select: { isApproved: true, isClosed: true, bakeryId: true } } } },
        deductions: true,
      },
    });
    if (!item) return notFound("Checklist item");

    // Multi-tenancy: ensure this checklist item belongs to the user's bakery
    if (item.batch.schedule.bakeryId !== session!.user.bakeryId) {
      return error("Forbidden", 403);
    }

    // Don't allow ticking items on unapproved schedules
    if (!item.batch.schedule.isApproved) {
      return error("Schedule must be approved before checklist items can be updated", 403);
    }

    // Don't allow editing a completed & archived run. Its stock was really
    // consumed; unticking here would restore stock on a finished run and break
    // the close invariant. (Guards the race between a head-baker close and a
    // floor tablet that hasn't refreshed yet.)
    if (item.batch.schedule.isClosed) {
      return error("This production run has been completed and archived; its checklist can no longer be changed.", 409);
    }

    // Enforce sequential order — all previous items must be DONE or SKIPPED
    if (parsed.data.status === "DONE" || parsed.data.status === "IN_PROGRESS") {
      const previousItems = await db.checklistItem.findMany({
        where: {
          batchId: params.batchId,
          order:   { lt: item.order },
        },
        select: { status: true, order: true },
        orderBy: { order: "asc" },
      });

      const allPreviousDone = previousItems.every(
        (prev) => prev.status === "DONE" || prev.status === "SKIPPED"
      );

      if (!allPreviousDone) {
        return error("Complete the previous steps first", 400);
      }
    }

    const isDone = parsed.data.status === "DONE";
    const wasUndone = item.status === "DONE" && parsed.data.status === "PENDING";

    // ── Wrap everything in a transaction ─────────────────────────────────
    // This ensures deduction and status update succeed or fail together
    const updated = await db.$transaction(async (tx) => {
      // Collect all deductions for this step
      const stepDeductions: Array<{ ingredientId: string; grams: number }> = [];

      if (item.deductions && item.deductions.length > 0) {
        for (const d of item.deductions) {
          stepDeductions.push({ ingredientId: d.ingredientId, grams: d.deductionGrams });
        }
      } else if (item.ingredientId && item.deductionGrams) {
        stepDeductions.push({ ingredientId: item.ingredientId, grams: item.deductionGrams });
      }

      if (stepDeductions.length > 0) {
        if (isDone && item.status !== "DONE") {
          for (const d of stepDeductions) {
            const ingredient = await tx.ingredient.findUnique({ where: { id: d.ingredientId } });
            if (ingredient) {
              // NOTE: do NOT clamp at 0 here. Clamping the deduct while the
              // restore adds back the full amount is what created phantom stock
              // (deduct-to-zero then untick inflated the balance). Allowing the
              // balance to go negative keeps deduct/restore perfectly symmetric;
              // the UI displays anything ≤0 as "out of stock" / 0 g.
              const newStock = Number(ingredient.stockGrams) - d.grams;
              const alertLevel = computeAlertLevel(
                newStock,
                Number(ingredient.criticalThresholdGrams),
                Number(ingredient.reorderThresholdGrams)
              );
              await tx.ingredient.update({
                where: { id: d.ingredientId },
                data: { stockGrams: newStock, alertLevel },
              });
            }
          }
        } else if (wasUndone) {
          for (const d of stepDeductions) {
            const ingredient = await tx.ingredient.findUnique({ where: { id: d.ingredientId } });
            if (ingredient) {
              const newStock = Number(ingredient.stockGrams) + d.grams;
              const alertLevel = computeAlertLevel(
                newStock,
                Number(ingredient.criticalThresholdGrams),
                Number(ingredient.reorderThresholdGrams)
              );
              await tx.ingredient.update({
                where: { id: d.ingredientId },
                data: { stockGrams: newStock, alertLevel },
              });
            }
          }
        }
      }

      // Update checklist item status
      const result = await tx.checklistItem.update({
        where: { id: parsed.data.itemId },
        data: {
          status:        parsed.data.status,
          notes:         parsed.data.notes ?? null,
          completedById: isDone ? session!.user.id : null,
          completedAt:   isDone ? new Date() : null,
        },
      });

      // If unticking, revert subsequent steps
      if (wasUndone) {
        const subsequentItems = await tx.checklistItem.findMany({
          where: { batchId: params.batchId, order: { gt: item.order }, status: "DONE" },
          include: { deductions: true },
        });

        for (const sub of subsequentItems) {
          const subDeductions: Array<{ ingredientId: string; grams: number }> = [];
          if (sub.deductions && sub.deductions.length > 0) {
            for (const d of sub.deductions) {
              subDeductions.push({ ingredientId: d.ingredientId, grams: d.deductionGrams });
            }
          } else if (sub.ingredientId && sub.deductionGrams) {
            subDeductions.push({ ingredientId: sub.ingredientId, grams: sub.deductionGrams });
          }

          for (const d of subDeductions) {
            const ingredient = await tx.ingredient.findUnique({ where: { id: d.ingredientId } });
            if (ingredient) {
              const newStock = Number(ingredient.stockGrams) + d.grams;
              const alertLevel = computeAlertLevel(
                newStock,
                Number(ingredient.criticalThresholdGrams),
                Number(ingredient.reorderThresholdGrams)
              );
              await tx.ingredient.update({
                where: { id: d.ingredientId },
                data: { stockGrams: newStock, alertLevel },
              });
            }
          }

          await tx.checklistItem.update({
            where: { id: sub.id },
            data: { status: "PENDING", completedById: null, completedAt: null },
          });
        }
      }

      // ── Advance the batch status to reflect checklist progress ──────────
      // SCHEDULED (nothing started) → IN_PROGRESS (some done) → COMPLETED (all done).
      // Recomputed from the actual item states so it's always accurate, whether
      // the user just ticked, unticked, or cascade-reverted steps above.
      const batchItems = await tx.checklistItem.findMany({
        where:  { batchId: params.batchId },
        select: { status: true },
      });
      const total    = batchItems.length;
      const doneCount = batchItems.filter((i) => i.status === "DONE").length;
      const batchStatus =
        total > 0 && doneCount === total ? "COMPLETED" :
        doneCount > 0                    ? "IN_PROGRESS" :
        "SCHEDULED";
      await tx.productionBatch.update({
        where: { id: params.batchId },
        data:  { status: batchStatus },
      });

      return result;
    });

    // Post-transaction: trigger alerts if stock dropped (outside transaction)
    if (isDone && item.status !== "DONE") {
      const stepDeductions: Array<{ ingredientId: string; grams: number }> = [];
      if (item.deductions && item.deductions.length > 0) {
        for (const d of item.deductions) {
          stepDeductions.push({ ingredientId: d.ingredientId, grams: d.deductionGrams });
        }
      } else if (item.ingredientId && item.deductionGrams) {
        stepDeductions.push({ ingredientId: item.ingredientId, grams: item.deductionGrams });
      }
      for (const d of stepDeductions) {
        const ingredient = await db.ingredient.findUnique({ where: { id: d.ingredientId } });
        if (ingredient) {
          const alertLevel = computeAlertLevel(
            Number(ingredient.stockGrams),
            Number(ingredient.criticalThresholdGrams),
            Number(ingredient.reorderThresholdGrams)
          );
          await handleStockChange({
            ingredientId: d.ingredientId,
            bakeryId: session!.user.bakeryId,
            newStock: Number(ingredient.stockGrams),
            alertLevel,
          });
        }
      }
    }

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}
