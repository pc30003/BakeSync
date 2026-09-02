"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Bot, Lightbulb, TrendingDown, DollarSign } from "lucide-react";

interface WastageAnalysis {
  analysis: string;
  suggestions: string[];
  topIssue: string;
  estimatedSavings: string;
}

export function AIWastageButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<WastageAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/agent/analyze-wastage", { method: "POST" });
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <CardTitle>AI Wastage Analysis</CardTitle>
          </div>
          <Button size="sm" variant="primary" loading={isPending} onClick={handleAnalyze}>
            {result ? "Re-analyze" : "Analyze wastage"}
          </Button>
        </div>
      </CardHeader>
      {result && (
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground">{result.analysis}</p>

          {result.topIssue && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <TrendingDown className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-destructive">Top Issue</p>
                <p className="text-sm text-foreground">{result.topIssue}</p>
              </div>
            </div>
          )}

          {result.estimatedSavings && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-900/50">
              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-300">Potential monthly savings: <strong>{result.estimatedSavings}</strong></p>
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" /> Suggestions
              </p>
              <ul className="space-y-1.5">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
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
