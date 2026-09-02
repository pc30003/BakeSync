"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Bot, AlertTriangle, ShoppingCart, CheckCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProcurementRec {
  ingredient: string;
  urgency: string;
  reason: string;
  suggestedQuantityKg: number;
  estimatedCost: number;
  supplier: string;
  orderBy: string;
}

interface ProcurementAnalysis {
  summary: string;
  recommendations: ProcurementRec[];
  riskAlert: string;
}

export function AIProcurementButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ProcurementAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-row order state, keyed by the recommendation index.
  const [orderingIdx, setOrderingIdx] = useState<number | null>(null);
  const [orderedIdx, setOrderedIdx] = useState<Set<number>>(new Set());

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/agent/smart-procurement", { method: "POST" });
        const json = await res.json();
        if (res.ok) {
          setResult(json.data);
          setOrderedIdx(new Set()); // reset order state for a fresh analysis
        } else {
          setError(json.error ?? "Analysis failed");
        }
      } catch {
        setError("Network error");
      }
    });
  }

  async function handleOrder(rec: ProcurementRec, idx: number) {
    if (orderingIdx !== null || orderedIdx.has(idx)) return;
    setOrderingIdx(idx);
    try {
      const res = await fetch("/api/agent/smart-procurement/order", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ingredientName: rec.ingredient,
          quantityKg:     rec.suggestedQuantityKg,
        }),
      });
      // 200 = ordered now. 409 = already ordered / already well-stocked —
      // either way the stock is restored, so mark the row as done (no double-restock).
      if (res.ok || res.status === 409) {
        setOrderedIdx((prev) => new Set(prev).add(idx));
        router.refresh(); // stock levels + KPI counts update live
      }
    } catch {
      // silent — button re-enables so the user can retry
    } finally {
      setOrderingIdx(null);
    }
  }

  const urgencyVariant = (u: string) =>
    u === "CRITICAL" ? "danger" :
    u === "HIGH"     ? "warning" :
    u === "MEDIUM"   ? "info" :
    "outline";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <CardTitle>AI Procurement Intelligence</CardTitle>
          </div>
          <Button size="sm" variant="primary" loading={isPending} onClick={handleAnalyze}>
            {result ? "Refresh" : "Analyze supply needs"}
          </Button>
        </div>
      </CardHeader>
      {result && (
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground">{result.summary}</p>

          {result.riskAlert && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Supply Risk</p>
                <p className="text-sm text-amber-900 dark:text-amber-200">{result.riskAlert}</p>
              </div>
            </div>
          )}

          {result.recommendations.length > 0 && (
            <ul className="divide-y divide-border" role="list">
              {result.recommendations.map((rec, i) => {
                const isOrdering = orderingIdx === i;
                const isOrdered  = orderedIdx.has(i);
                const canOrder   = !!rec.ingredient && Number(rec.suggestedQuantityKg) > 0;
                return (
                  <li key={i} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{rec.ingredient}</span>
                        <Badge variant={urgencyVariant(rec.urgency) as any}>{rec.urgency}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        Order {rec.suggestedQuantityKg} kg from {rec.supplier} · Est. ${rec.estimatedCost?.toFixed(2)} · Order by: {rec.orderBy}
                      </p>
                    </div>

                    {/* Actionable order button */}
                    {isOrdered ? (
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-medium shrink-0 pt-0.5">
                        <CheckCircle className="w-4 h-4" />
                        Ordered
                      </div>
                    ) : canOrder ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOrder(rec, i)}
                        disabled={orderingIdx !== null}
                        className="shrink-0"
                        leftIcon={isOrdering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
                      >
                        {isOrdering ? "Ordering…" : "Order now"}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      )}
      {error && (
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      )}
    </Card>
  );
}
