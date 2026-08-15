import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, requireAuth } from "@/lib/api-helpers";

// GET /api/procurement — list pending procurement recommendations
export async function GET(req: NextRequest) {
  const { session, response } = await requireAuth(["HEAD_BAKER", "PURCHASING_MANAGER"]);
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const urgency   = searchParams.get("urgency") ?? undefined;
    const approved  = searchParams.get("approved");

    const recommendations = await db.procurementRecommendation.findMany({
      where: {
        bakeryId: session!.user.bakeryId,
        ...(urgency  && { urgency }),
        ...(approved === "true"  && { approvedAt: { not: null } }),
        ...(approved === "false" && { approvedAt: null, dismissedAt: null }),
      },
      include: {
        ingredient: { select: { id: true, name: true, unit: true, category: true } },
        supplier:   { select: { id: true, name: true, leadTimeDays: true, contactEmail: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: [
        // Sort CRITICAL → HIGH → MEDIUM → LOW
        { urgency: "desc" },
        { generatedAt: "desc" },
      ],
    });

    return ok(recommendations);
  } catch (err) {
    return serverError(err);
  }
}
