import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, serverError, validationError, requireAuth } from "@/lib/api-helpers";

const DismissSchema = z.object({
  ids: z.array(z.string()).min(1),
});

// GET /api/alerts — get active agent alerts
export async function GET(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";

    const alerts = await db.agentAlert.findMany({
      where: {
        bakeryId:    session!.user.bakeryId,
        isDismissed: false,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: "desc" },
    });

    // Severity is a string column, so DB sort would be alphabetical (wrong).
    // Sort by true severity rank: CRITICAL → WARNING → INFO, newest first within a tier.
    const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    const sorted = [...alerts].sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99)
    );

    return ok(sorted);
  } catch (err) {
    return serverError(err);
  }
}

// PATCH /api/alerts — mark as read
export async function PATCH(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = DismissSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    await db.agentAlert.updateMany({
      where: {
        id:      { in: parsed.data.ids },
        bakeryId: session!.user.bakeryId,
      },
      data: { isRead: true },
    });

    return ok({ updated: parsed.data.ids.length });
  } catch (err) {
    return serverError(err);
  }
}

// DELETE /api/alerts — dismiss alerts
export async function DELETE(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const body = await req.json();
    const parsed = DismissSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    await db.agentAlert.updateMany({
      where: {
        id:      { in: parsed.data.ids },
        bakeryId: session!.user.bakeryId,
      },
      data: { isDismissed: true },
    });

    return ok({ dismissed: parsed.data.ids.length });
  } catch (err) {
    return serverError(err);
  }
}
