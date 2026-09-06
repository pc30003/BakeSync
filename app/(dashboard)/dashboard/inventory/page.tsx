import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { StockLevelBar } from "@/components/ui/stock-level-bar";
import { formatGrams, formatCurrency } from "@/lib/utils";
import { RelativeTime } from "@/components/ui/relative-time";
import { Package } from "lucide-react";

export const metadata: Metadata = { title: "Inventory" };

export const revalidate = 2;

const alertVariant: Record<string, string> = {
  OK:            "success",
  LOW:           "warning",
  CRITICAL:      "danger",
  OUT_OF_STOCK:  "danger",
};

export default async function InventoryPage() {
  const session     = await auth();
  const bakeryId    = session!.user.bakeryId;
  const [bakery, ingredients] = await Promise.all([
    db.bakery.findUnique({ where: { id: bakeryId }, select: { currency: true } }),
    db.ingredient.findMany({
      where:   { bakeryId, isTracked: true },
      include: { supplier: { select: { name: true } } },
      orderBy: [{ alertLevel: "asc" }, { name: "asc" }],
    }),
  ]);
  const currency = bakery?.currency ?? "USD";

  // "Last restocked" = the most recent approved procurement for each ingredient.
  // "Last restocked" must reflect EVERY restock path:
  //   a) manual approval        → procurementRecommendation.approvedAt
  //   b) AI "Order now"         → logs an AgentAction (PROCUREMENT_RECOMMENDATION)
  //                               with details.ingredientId + completedAt, and
  //                               only stamps approvedAt when a PENDING rec
  //                               existed — so the rec table alone can miss it.
  // We merge both sources and keep the most recent per ingredient. Ingredients
  // never restocked show a dash.
  const lastRestocked = new Map<string, Date>();
  const noteRestock = (ingredientId: string | null | undefined, when: Date | null | undefined) => {
    if (!ingredientId || !when) return;
    const prev = lastRestocked.get(ingredientId);
    if (!prev || when.getTime() > prev.getTime()) {
      lastRestocked.set(ingredientId, when);
    }
  };

  const [approvedRecs, orderActions] = await Promise.all([
    db.procurementRecommendation.findMany({
      where:   { bakeryId, approvedAt: { not: null } },
      select:  { ingredientId: true, approvedAt: true },
      orderBy: { approvedAt: "desc" },
    }),
    db.agentAction.findMany({
      where:   { bakeryId, type: "PROCUREMENT_RECOMMENDATION", completedAt: { not: null } },
      select:  { details: true, completedAt: true },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  for (const rec of approvedRecs) {
    noteRestock(rec.ingredientId, rec.approvedAt);
  }
  for (const action of orderActions) {
    const ingredientId = (action.details as { ingredientId?: string } | null)?.ingredientId ?? null;
    noteRestock(ingredientId, action.completedAt);
  }

  const byAlert = {
    OUT_OF_STOCK: ingredients.filter((i) => i.alertLevel === "OUT_OF_STOCK"),
    CRITICAL:     ingredients.filter((i) => i.alertLevel === "CRITICAL"),
    LOW:          ingredients.filter((i) => i.alertLevel === "LOW"),
    OK:           ingredients.filter((i) => i.alertLevel === "OK"),
  };

  return (
    <div className="space-y-6">
      <AutoRefresh interval={2000} />
      <PageHeader
        title="Stock Levels"
        description={`${ingredients.length} tracked ingredients`}
      />

      {/* Alert summary chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(byAlert).map(([level, items]) => (
          items.length > 0 && (
            <div
              key={level}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-medium"
            >
              <span>{level.replace("_", " ")}</span>
              <Badge variant={alertVariant[level] as any} className="rounded-full">
                {items.length}
              </Badge>
            </div>
          )
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {ingredients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                <Package className="w-6 h-6" />
              </div>
              <p className="text-base font-semibold text-foreground">No ingredients tracked yet</p>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
                Once ingredients are added to your bakery, their live stock levels and alerts will appear here.
              </p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ingredient</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stock Level</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">Cost/kg</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Last restocked</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ingredients.map((ing) => (
                  <tr key={ing.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{ing.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                      {ing.category}
                    </td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <StockLevelBar
                        current={Number(ing.stockGrams)}
                        reorder={Number(ing.reorderThresholdGrams)}
                        critical={Number(ing.criticalThresholdGrams)}
                        label={formatGrams(Number(ing.stockGrams))}
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">
                      {formatCurrency(Number(ing.costPerKg), currency)}/kg
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
                      {ing.supplier?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs whitespace-nowrap">
                      <RelativeTime
                        date={lastRestocked.get(ing.id)?.toISOString() ?? null}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={alertVariant[ing.alertLevel] as any}>
                        {ing.alertLevel.replace("_", " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
