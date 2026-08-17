import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockLevelBar } from "@/components/ui/stock-level-bar";
import { formatGrams, formatCurrency } from "@/lib/utils";

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
  const ingredients = await db.ingredient.findMany({
    where:   { bakeryId: session!.user.bakeryId, isTracked: true },
    include: { supplier: { select: { name: true } } },
    orderBy: [{ alertLevel: "asc" }, { name: "asc" }],
  });

  const byAlert = {
    OUT_OF_STOCK: ingredients.filter((i) => i.alertLevel === "OUT_OF_STOCK"),
    CRITICAL:     ingredients.filter((i) => i.alertLevel === "CRITICAL"),
    LOW:          ingredients.filter((i) => i.alertLevel === "LOW"),
    OK:           ingredients.filter((i) => i.alertLevel === "OK"),
  };

  return (
    <div className="space-y-6">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ingredient</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stock Level</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">Cost/kg</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Supplier</th>
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
                      {formatCurrency(Number(ing.costPerKg))}/kg
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
                      {ing.supplier?.name ?? "—"}
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
        </CardContent>
      </Card>
    </div>
  );
}
