import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatGrams, formatCurrency } from "@/lib/utils";
import { ShoppingCart, AlertTriangle, Truck, Package } from "lucide-react";
import { ProcurementApproveButton } from "@/components/purchasing/approve-button";
import { AIProcurementButton } from "@/components/agent/ai-procurement-button";

export const metadata: Metadata = { title: "Procurement Dashboard" };

export default async function PurchasingDashboard() {
  const session = await auth();
  const bakeryId = session!.user.bakeryId;
  const now = new Date();

  const [pendingRecs, criticalRecs, suppliers, recentApprovals] = await Promise.all([
    // All pending (unapproved, undismissed) recommendations
    db.procurementRecommendation.findMany({
      where: { bakeryId, approvedAt: null, dismissedAt: null },
      include: {
        ingredient: { select: { id: true, name: true, unit: true, category: true } },
        supplier:   { select: { id: true, name: true, leadTimeDays: true, contactEmail: true } },
      },
      orderBy: [{ urgency: "desc" }, { generatedAt: "desc" }],
    }),
    // CRITICAL only
    db.procurementRecommendation.count({
      where: { bakeryId, approvedAt: null, dismissedAt: null, urgency: "CRITICAL" },
    }),
    // Active supplier count
    db.supplier.count({ where: { bakeryId, isActive: true } }),
    // Recently approved in last 7 days
    db.procurementRecommendation.count({
      where: {
        bakeryId,
        approvedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const urgencyVariant = (u: string) =>
    u === "CRITICAL" ? "danger" :
    u === "HIGH"     ? "warning" :
    u === "MEDIUM"   ? "info" :
    "outline";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement"
        description={`${formatDate(now)} — review and approve purchasing recommendations`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Approvals"
          value={pendingRecs.length}
          subtitle="recommendations awaiting action"
          icon={<ShoppingCart className="w-5 h-5" />}
          variant={pendingRecs.length > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Critical Items"
          value={criticalRecs}
          subtitle="need immediate ordering"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant={criticalRecs > 0 ? "danger" : "default"}
        />
        <StatCard
          title="Active Suppliers"
          value={suppliers}
          subtitle="in your supplier directory"
          icon={<Truck className="w-5 h-5" />}
        />
        <StatCard
          title="Approved (7 days)"
          value={recentApprovals}
          subtitle="orders placed this week"
          icon={<Package className="w-5 h-5" />}
          variant="success"
        />
      </div>

      {/* Recommendations list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Purchasing Recommendations</CardTitle>
            <span className="text-xs text-muted-foreground">
              {pendingRecs.length} pending
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pendingRecs.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No pending recommendations — all procurement is up to date.
            </div>
          ) : (
            <ul className="divide-y divide-border" role="list">
              {pendingRecs.map((rec) => (
                <li key={rec.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{rec.ingredient.name}</p>
                      <Badge variant={urgencyVariant(rec.urgency) as any}>
                        {rec.urgency}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      In stock: {formatGrams(Number(rec.currentStockGrams))}
                      &nbsp;·&nbsp;
                      Shortfall: {formatGrams(Number(rec.shortfallGrams))}
                      &nbsp;·&nbsp;
                      Order: <strong>{formatGrams(Number(rec.recommendedOrderGrams))}</strong>
                    </p>
                    {rec.supplier && (
                      <p className="text-xs text-muted-foreground">
                        Supplier: {rec.supplier.name}
                        &nbsp;·&nbsp;
                        Lead time: {rec.supplier.leadTimeDays}d
                        {rec.estimatedCost && (
                          <>&nbsp;·&nbsp;Est. cost: {formatCurrency(Number(rec.estimatedCost))}</>
                        )}
                      </p>
                    )}
                  </div>
                  <ProcurementApproveButton recommendationId={rec.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* AI Procurement Intelligence */}
      <AIProcurementButton />
    </div>
  );
}
