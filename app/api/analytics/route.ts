import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, requireAuth } from "@/lib/api-helpers";
import { startOfDay, endOfDay, subDays } from "date-fns";

// GET /api/analytics — KPI snapshot + recent trends
export async function GET(req: NextRequest) {
  const { session, response } = await requireAuth();
  if (response) return response;

  try {
    const bakeryId = session!.user.bakeryId;
    const now      = new Date();
    const today    = startOfDay(now);
    const last30   = subDays(today, 30);

    const [
      activeOrders,
      criticalStock,
      pendingProcurements,
      unreadAlerts,
      todaySchedules,
      recentWastage,
    ] = await Promise.all([
      // Active orders due today or in future
      db.order.count({
        where: {
          bakeryId,
          status: { in: ["PENDING", "CONFIRMED", "IN_PRODUCTION"] },
          fulfilmentDate: { gte: today },
        },
      }),

      // Ingredients at critical or out-of-stock
      db.ingredient.count({
        where: {
          bakeryId,
          alertLevel: { in: ["CRITICAL", "OUT_OF_STOCK"] },
        },
      }),

      // Unapproved procurement recommendations
      db.procurementRecommendation.count({
        where: { bakeryId, approvedAt: null, dismissedAt: null },
      }),

      // Unread agent alerts
      db.agentAlert.count({
        where: { bakeryId, isRead: false, isDismissed: false },
      }),

      // Today's schedule batches
      db.productionBatch.count({
        where: {
          schedule: {
            bakeryId,
            scheduleDate: { gte: startOfDay(now), lte: endOfDay(now) },
          },
        },
      }),

      // Wastage in last 30 days
      db.wastageLog.aggregate({
        where: { bakeryId, shiftDate: { gte: last30 } },
        _sum: { quantityGrams: true },
      }),
    ]);

    return ok({
      snapshot: {
        activeOrders,
        criticalStock,
        pendingProcurements,
        unreadAlerts,
        todayBatches: todaySchedules,
        wastage30dGrams: Number(recentWastage._sum.quantityGrams ?? 0),
      },
      generatedAt: now,
    });
  } catch (err) {
    return serverError(err);
  }
}
