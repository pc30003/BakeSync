import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime, getBatchStatusColor, formatGrams } from "@/lib/utils";
import {
  ShoppingBag, Package, ShoppingCart, CalendarDays, AlertTriangle
} from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";

export const metadata: Metadata = { title: "Head Baker Dashboard" };

export const revalidate = 2;

export default async function HeadBakerDashboard() {
  const session = await auth();
  const bakeryId = session!.user.bakeryId;
  const now   = new Date();
  const today = startOfDay(now);

  const [
    activeOrders,
    criticalIngredients,
    pendingProcurements,
    todaySchedule,
    unreadAlerts,
  ] = await Promise.all([
    db.order.count({
      where: {
        bakeryId,
        status: { in: ["PENDING", "CONFIRMED", "IN_PRODUCTION"] },
        fulfilmentDate: { gte: today },
      },
    }),
    db.ingredient.findMany({
      where: { bakeryId, alertLevel: { in: ["CRITICAL", "OUT_OF_STOCK"] } },
      select: { id: true, name: true, stockGrams: true, alertLevel: true },
      take: 5,
    }),
    db.procurementRecommendation.count({
      where: { bakeryId, approvedAt: null, dismissedAt: null },
    }),
    db.productionSchedule.findFirst({
      where: {
        bakeryId,
        scheduleDate: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      include: {
        batches: {
          include: { recipe: { select: { name: true, category: true } } },
          orderBy: { plannedStartTime: "asc" },
        },
      },
    }),
    db.agentAlert.findMany({
      where: { bakeryId, isDismissed: false },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
  ]);

  const greetingHour = now.getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" :
    greetingHour < 17 ? "Good afternoon" :
    "Good evening";

  return (
    <div className="space-y-6">
      <AutoRefresh interval={3000} />
      <PageHeader
        title={`${greeting}, ${session!.user.name?.split(" ")[0] ?? "Chef"}`}
        description={`${formatDate(now)} — here's today's kitchen overview`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Orders"
          value={activeOrders}
          subtitle="due today or upcoming"
          icon={<ShoppingBag className="w-5 h-5" />}
        />
        <StatCard
          title="Critical Stock"
          value={criticalIngredients.length}
          subtitle="ingredients need attention"
          icon={<Package className="w-5 h-5" />}
          variant={criticalIngredients.length > 0 ? "danger" : "default"}
        />
        <StatCard
          title="Pending Orders"
          value={pendingProcurements}
          subtitle="awaiting approval"
          icon={<ShoppingCart className="w-5 h-5" />}
          variant={pendingProcurements > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Today's Batches"
          value={todaySchedule?.batches.length ?? 0}
          subtitle={todaySchedule?.isApproved ? "schedule approved" : "pending approval"}
          icon={<CalendarDays className="w-5 h-5" />}
          variant={!todaySchedule?.isApproved && (todaySchedule?.batches.length ?? 0) > 0 ? "warning" : "default"}
        />
      </div>

      {/* Agent alerts */}
      {unreadAlerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Agent Alerts
          </h2>
          <div className="space-y-2">
            {unreadAlerts.map((alert) => (
              <AlertBanner key={alert.id} alert={alert as any} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Production Schedule</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!todaySchedule || todaySchedule.batches.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No schedule generated yet for today.
              </div>
            ) : (
              <ul className="divide-y divide-border" role="list">
                {todaySchedule.batches.map((batch) => (
                  <li key={batch.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{batch.recipe.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(batch.plannedStartTime)} — {formatTime(batch.plannedEndTime)}
                        &nbsp;·&nbsp;{batch.quantity} units
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getBatchStatusColor(batch.status)}`}>
                      {batch.status.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Critical stock */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Stock Alerts</CardTitle>
              {criticalIngredients.length > 0 && (
                <AlertTriangle className="w-4 h-4 text-destructive" aria-hidden="true" />
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {criticalIngredients.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                All stock levels are healthy.
              </div>
            ) : (
              <ul className="divide-y divide-border" role="list">
                {criticalIngredients.map((ing) => (
                  <li key={ing.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ing.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatGrams(Number(ing.stockGrams))} remaining
                      </p>
                    </div>
                    <Badge variant={ing.alertLevel === "OUT_OF_STOCK" ? "danger" : "warning"}>
                      {ing.alertLevel.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
