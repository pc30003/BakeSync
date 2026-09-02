import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatGrams, formatCurrency } from "@/lib/utils";
import { BarChart3, TrendingDown, Package, Zap } from "lucide-react";
import { subDays, startOfDay } from "date-fns";
import { redirect } from "next/navigation";
import { AIWastageButton } from "@/components/agent/ai-wastage-button";
import { StockHealthDonut, TopWasteBars } from "@/components/analytics/analytics-charts";

export const metadata: Metadata = { title: "Analytics" };

export const revalidate = 2;

export default async function AnalyticsPage() {
  const session  = await auth();

  // Analytics is Head Baker only (matches nav gating)
  if (session?.user.role !== "HEAD_BAKER") {
    redirect("/dashboard");
  }

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

  const stockByAlert = Object.fromEntries(stockAlerts.map((s) => [s.alertLevel, s._count])) as Record<string, number>;

  // ── Chart data ─────────────────────────────────────────────────────────
  const stockHealthData = [
    { name: "Healthy",      value: stockByAlert["OK"] ?? 0,           color: "#22C55E" },
    { name: "Low",          value: stockByAlert["LOW"] ?? 0,          color: "#EAB308" },
    { name: "Critical",     value: stockByAlert["CRITICAL"] ?? 0,     color: "#F97316" },
    { name: "Out of stock", value: stockByAlert["OUT_OF_STOCK"] ?? 0, color: "#EF4444" },
  ];

  const topWasteData = topWastageIngredients.map((w) => ({
    name:  w.ingredientId ? (nameMap[w.ingredientId] ?? "Unknown") : "Unknown",
    grams: Number(w._sum.quantityGrams ?? 0),
  }));

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
        {/* Stock health donut */}
        <Card>
          <CardHeader>
            <CardTitle>Current Stock Health</CardTitle>
          </CardHeader>
          <CardContent>
            <StockHealthDonut data={stockHealthData} />
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
              {stockHealthData.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name} <span className="font-medium text-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top wasted ingredients bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Wasted Ingredients (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <TopWasteBars data={topWasteData} />
          </CardContent>
        </Card>
      </div>

      {/* AI Analysis */}
      <AIWastageButton />
    </div>
  );
}
