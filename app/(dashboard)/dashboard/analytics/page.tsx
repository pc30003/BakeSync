import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatGrams, formatCurrency } from "@/lib/utils";
import { BarChart3, TrendingDown, Package, Zap } from "lucide-react";
import { subDays, startOfDay } from "date-fns";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const session  = await auth();
  const bakeryId = session!.user.bakeryId;
  const now      = new Date();
  const last30   = subDays(startOfDay(now), 30);
  const last7    = subDays(startOfDay(now), 7);

  const [
    wastage30d,
    wastage7d,
    completedBatches30d,
    totalBatches30d,
    approvedProcurements30d,
    stockAlerts,
    topWastageIngredients,
  ] = await Promise.all([
    db.wastageLog.aggregate({
      where: { bakeryId, shiftDate: { gte: last30 } },
      _sum: { quantityGrams: true },
    }),
    db.wastageLog.aggregate({
      where: { bakeryId, shiftDate: { gte: last7 } },
      _sum: { quantityGrams: true },
    }),
    db.productionBatch.count({
      where: {
        status: "COMPLETED",
        schedule: { bakeryId, scheduleDate: { gte: last30 } },
      },
    }),
    db.productionBatch.count({
      where: {
        schedule: { bakeryId, scheduleDate: { gte: last30 } },
      },
    }),
    db.procurementRecommendation.count({
      where: { bakeryId, approvedAt: { gte: last30 } },
    }),
    db.ingredient.groupBy({
      by: ["alertLevel"],
      where: { bakeryId, isTracked: true },
      _count: true,
    }),
    db.wastageLog.groupBy({
      by: ["ingredientId"],
      where: { bakeryId, shiftDate: { gte: last30 }, ingredientId: { not: null } },
      _sum: { quantityGrams: true },
      orderBy: { _sum: { quantityGrams: "desc" } },
      take: 5,
    }),
  ]);

  const completionRate = totalBatches30d > 0
    ? Math.round((completedBatches30d / totalBatches30d) * 100)
    : 0;

  const w30 = Number(wastage30d._sum.quantityGrams ?? 0);
  const w7  = Number(wastage7d._sum.quantityGrams ?? 0);

  // Fetch ingredient names for top wastage
  const ingredientIds = topWastageIngredients.map((w) => w.ingredientId!).filter(Boolean);
  const ingredientNames = await db.ingredient.findMany({
    where: { id: { in: ingredientIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(ingredientNames.map((i) => [i.id, i.name]));

  const stockByAlert = Object.fromEntries(stockAlerts.map((s) => [s.alertLevel, s._count]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Production and waste insights for the last 30 days"
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Batch Completion"
          value={`${completionRate}%`}
          subtitle={`${completedBatches30d} of ${totalBatches30d} batches`}
          icon={<Zap className="w-5 h-5" />}
          variant={completionRate >= 90 ? "success" : completionRate >= 70 ? "default" : "warning"}
        />
        <StatCard
          title="Waste (30 days)"
          value={formatGrams(w30)}
          subtitle="total recorded wastage"
          icon={<TrendingDown className="w-5 h-5" />}
          variant={w30 > 5000 ? "danger" : w30 > 2000 ? "warning" : "default"}
        />
        <StatCard
          title="Waste (7 days)"
          value={formatGrams(w7)}
          subtitle="this week"
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <StatCard
          title="Orders Placed"
          value={approvedProcurements30d}
          subtitle="procurement approvals"
          icon={<Package className="w-5 h-5" />}
          variant="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock health */}
        <Card>
          <CardHeader>
            <CardTitle>Current Stock Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Healthy",      key: "OK",            color: "bg-green-500" },
                { label: "Low",          key: "LOW",           color: "bg-yellow-400" },
                { label: "Critical",     key: "CRITICAL",      color: "bg-orange-500" },
                { label: "Out of stock", key: "OUT_OF_STOCK",  color: "bg-red-500" },
              ].map(({ label, key, color }) => {
                const count = stockByAlert[key] ?? 0;
                const total = Object.values(stockByAlert).reduce((a, b) => a + b, 0);
                const pct   = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${count} items`}>
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top wastage ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>Top Wasted Ingredients (30d)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topWastageIngredients.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground text-center">
                No wastage recorded in the last 30 days.
              </p>
            ) : (
              <ul className="divide-y divide-border" role="list">
                {topWastageIngredients.map((w, i) => (
                  <li key={w.ingredientId ?? i} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <p className="text-sm">{w.ingredientId ? (nameMap[w.ingredientId] ?? "Unknown") : "Unknown"}</p>
                    </div>
                    <p className="text-sm font-medium">{formatGrams(Number(w._sum.quantityGrams ?? 0))}</p>
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
