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
      include: { batch: { include: { schedule: { select: { isApproved: true } } } } },
    });
    if (!item) return notFound("Checklist item");

    // Don't allow ticking items on unapproved schedules
    if (!item.batch.schedule.isApproved) {
      return error("Schedule must be approved before checklist items can be updated", 403);
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

    // ── Per-step stock deduction/restoration ─────────────────────────────
    if (item.ingredientId && item.deductionGrams) {
      const deductionGrams = item.deductionGrams;

      if (isDone && item.status !== "DONE") {
        // Ticking → deduct stock
        const ingredient = await db.ingredient.findUnique({ where: { id: item.ingredientId } });
        if (ingredient) {
          const newStock = Math.max(0, Number(ingredient.stockGrams) - deductionGrams);
          const alertLevel = computeAlertLevel(
            newStock,
            Number(ingredient.criticalThresholdGrams),
            Number(ingredient.reorderThresholdGrams)
          );
          await db.ingredient.update({
            where: { id: item.ingredientId },
            data: { stockGrams: newStock, alertLevel },
          });
          // Trigger alerts/procurement if needed
          await handleStockChange({
            ingredientId: item.ingredientId,
            bakeryId: session!.user.bakeryId,
            newStock,
            alertLevel,
          });
        }
      } else if (wasUndone) {
        // Unticking → restore stock
        const ingredient = await db.ingredient.findUnique({ where: { id: item.ingredientId } });
        if (ingredient) {
          const newStock = Number(ingredient.stockGrams) + deductionGrams;
          const alertLevel = computeAlertLevel(
            newStock,
            Number(ingredient.criticalThresholdGrams),
            Number(ingredient.reorderThresholdGrams)
          );
          await db.ingredient.update({
            where: { id: item.ingredientId },
            data: { stockGrams: newStock, alertLevel },
          });
        }
      }
    }

    // ── Update checklist item status ─────────────────────────────────────
    const updated = await db.checklistItem.update({
      where: { id: parsed.data.itemId },
      data: {
        status:        parsed.data.status,
        notes:         parsed.data.notes ?? null,
        completedById: isDone ? session!.user.id : null,
        completedAt:   isDone ? new Date() : null,
      },
    });

    // ── If unticking, also revert all subsequent steps ───────────────────
    if (wasUndone) {
      const subsequentItems = await db.checklistItem.findMany({
        where: {
          batchId: params.batchId,
          order: { gt: item.order },
          status: "DONE",
        },
      });

      for (const sub of subsequentItems) {
        // Restore stock for subsequent ticked items
        if (sub.ingredientId && sub.deductionGrams) {
          const ingredient = await db.ingredient.findUnique({ where: { id: sub.ingredientId } });
          if (ingredient) {
            const newStock = Number(ingredient.stockGrams) + sub.deductionGrams;
            const alertLevel = computeAlertLevel(
              newStock,
              Number(ingredient.criticalThresholdGrams),
              Number(ingredient.reorderThresholdGrams)
            );
            await db.ingredient.update({
              where: { id: sub.ingredientId },
              data: { stockGrams: newStock, alertLevel },
            });
          }
        }

        await db.checklistItem.update({
          where: { id: sub.id },
          data: { status: "PENDING", completedById: null, completedAt: null },
        });
      }
    }

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}
