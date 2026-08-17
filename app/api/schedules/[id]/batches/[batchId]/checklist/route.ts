import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, notFound, serverError, validationError, requireAuth } from "@/lib/api-helpers";

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
      return ok({ error: "Schedule must be approved before checklist items can be updated" });
    }

    const isDone = parsed.data.status === "DONE";

    const updated = await db.checklistItem.update({
      where: { id: parsed.data.itemId },
      data: {
        status:         parsed.data.status,
        notes:          parsed.data.notes ?? null,
        completedById:  isDone ? session!.user.id : null,
        completedAt:    isDone ? new Date() : null,
      },
    });

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}
