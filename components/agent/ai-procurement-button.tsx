"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Bot, AlertTriangle, ShoppingCart } from "lucide-react";
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
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ProcurementAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/agent/smart-procurement", { method: "POST" });
        const json = await res.json();
        if (res.ok) {
          setResult(json.data);
        } else {
          setError(json.error ?? "Analysis failed");
        }
      } catch {
        setError("Network error");
      }
    });
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
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Supply Risk</p>
                <p className="text-sm text-amber-900">{result.riskAlert}</p>
              </div>
            </div>
          )}

          {result.recommendations.length > 0 && (
            <ul className="divide-y divide-border" role="list">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{rec.ingredient}</span>
                    <Badge variant={urgencyVariant(rec.urgency) as any}>{rec.urgency}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{rec.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Order {rec.suggestedQuantityKg} kg from {rec.supplier} · Est. ${rec.estimatedCost?.toFixed(2)} · Order by: {rec.orderBy}
                  </p>
                </li>
              ))}
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
