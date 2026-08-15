import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, notFound, serverError, requireAuth } from "@/lib/api-helpers";

// POST /api/procurement/[id]/approve — one-click approval
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, response } = await requireAuth(["PURCHASING_MANAGER", "HEAD_BAKER"]);
  if (response) return response;

  try {
    const existing = await db.procurementRecommendation.findFirst({
      where: { id: params.id, bakeryId: session!.user.bakeryId },
    });
    if (!existing) return notFound("Procurement recommendation");

    const updated = await db.procurementRecommendation.update({
      where: { id: params.id },
      data: {
        approvedAt:   new Date(),
        approvedById: session!.user.id,
      },
      include: {
        ingredient: { select: { id: true, name: true } },
        supplier:   { select: { id: true, name: true } },
      },
    });

    return ok(updated);
  } catch (err) {
    return serverError(err);
  }
}
