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
      orderBy: { generatedAt: "desc" },
    });

    // Urgency is a string column, so DB sort would be alphabetical (wrong).
    // Sort by true severity rank: CRITICAL → HIGH → MEDIUM → LOW, newest first within a tier.
    const URGENCY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sorted = [...recommendations].sort(
      (a, b) => (URGENCY_RANK[a.urgency] ?? 99) - (URGENCY_RANK[b.urgency] ?? 99)
    );

    return ok(sorted);
  } catch (err) {
    return serverError(err);
  }
}
