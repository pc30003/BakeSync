"use client";

/**
 * AgentLogPanel
 *
 * Connects to /api/agent/stream via Server-Sent Events and renders
 * every agent step as it arrives — giving judges a live view of the
 * agent reasoning in real time.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, Loader2, CheckCircle2, XCircle, ChevronDown,
  ChevronUp, Zap, RefreshCw, Calendar, AlertTriangle,
} from "lucide-react";
import { cn, formatGrams } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ALL_SHIFT_TYPES, getShiftLabel, getShiftIcon } from "@/lib/shifts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id:      string;
  type:    string;
  message: string;
  detail?: string;
  ts:      number;
  data?:   Record<string, unknown>;
}

interface AgentLogPanelProps {
  scheduleDate: string;    // ISO date string
  shiftType:    string;
  hasExisting:  boolean;   // whether an unapproved schedule already exists
}

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEP_META: Record<string, { icon: React.ElementType; color: string }> = {
  context_start:   { icon: Loader2,       color: "text-blue-500"  },
  context_done:    { icon: CheckCircle2,  color: "text-blue-600"  },
  planner_start:   { icon: Bot,           color: "text-purple-500" },
  planner_done:    { icon: CheckCircle2,  color: "text-purple-600" },
  batch_planned:   { icon: Calendar,      color: "text-amber-600" },
  write_start:     { icon: Loader2,       color: "text-orange-500" },
  write_done:      { icon: CheckCircle2,  color: "text-orange-600" },
  complete:        { icon: Zap,           color: "text-green-600" },
  error:           { icon: XCircle,       color: "text-red-600"   },
  already_approved:{ icon: CheckCircle2,  color: "text-green-600" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentLogPanel({ scheduleDate, shiftType, hasExisting }: AgentLogPanelProps) {
  const router = useRouter();
  const [log,       setLog]       = useState<LogEntry[]>([]);
  const [running,   setRunning]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [expanded,  setExpanded]  = useState(true);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>(shiftType);
  const logEndRef     = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const entryCounter  = useRef(0);

  // Auto-scroll to bottom as log grows
  useEffect(() => {
    if (expanded) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [log, expanded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { eventSourceRef.current?.close(); };
  }, []);

  function addEntry(type: string, message: string, detail?: string, data?: Record<string, unknown>) {
    setLog(prev => [...prev, {
      id:      String(entryCounter.current++),
      type,
      message,
      detail,
      ts:      Date.now(),
      data,
    }]);
  }

  async function runAgent(force = false) {
    // Close any existing stream
    eventSourceRef.current?.close();
    setLog([]);
    setDone(false);
    setScheduleId(null);
    setRunning(true);
    setExpanded(true);

    try {
      const res = await fetch("/api/agent/stream", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scheduleDate, shiftType: selectedShift, forceRegenerate: force }),
      });

      if (!res.ok || !res.body) {
        addEntry("error", "Failed to connect to agent stream.");
        setRunning(false);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";   // keep incomplete chunk

        for (const chunk of lines) {
          const line = chunk.replace(/^data: /, "").trim();
          if (!line) continue;

          try {
            const event = JSON.parse(line) as {
              type: string;
              message: string;
              detail?: string;
              scheduleId?: string;
              [key: string]: unknown;
            };

            addEntry(event.type, event.message, event.detail, event);

            if (event.type === "complete" || event.type === "already_approved") {
              if (event.scheduleId) setScheduleId(event.scheduleId as string);
              setDone(true);
              setRunning(false);
              router.refresh();
            }
            if (event.type === "error") {
              setRunning(false);
            }
          } catch {
            // Ignore malformed lines
          }
        }
      }
    } catch (err) {
      addEntry("error", `Connection error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  const hasBatches  = log.some(e => e.type === "batch_planned");
  const hasError    = log.some(e => e.type === "error");
  const batchCount  = log.filter(e => e.type === "batch_planned").length;

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-card shadow-sm overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 bg-primary/5 border-b border-primary/10">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            running ? "bg-primary text-white animate-pulse" : "bg-primary/10 text-primary"
          )}>
            {running
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Bot className="w-5 h-5" />
            }
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">
              BakeSync Agent
              {running && (
                <span className="ml-2 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full animate-pulse">
                  RUNNING
                </span>
              )}
              {done && !hasError && (
                <span className="ml-2 text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                  COMPLETE
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {getShiftLabel(selectedShift)} · {new Date(scheduleDate).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {log.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              aria-label={expanded ? "Collapse log" : "Expand log"}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          {!running && (
            <>
              {/* Shift selector */}
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="text-xs rounded-lg border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Select shift to generate schedule for"
              >
                {ALL_SHIFT_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {getShiftIcon(s)} {getShiftLabel(s)}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant={done && !hasError ? "outline" : "primary"}
                onClick={() => runAgent(hasExisting || done)}
                leftIcon={done
                  ? <RefreshCw className="w-3.5 h-3.5" />
                  : <Zap className="w-3.5 h-3.5" />
                }
              >
                {done && !hasError
                  ? "Regenerate"
                  : hasExisting
                    ? "Regenerate schedule"
                    : "Generate schedule"
                }
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Log entries ───────────────────────────────────────────────────── */}
      {expanded && log.length > 0 && (
        <div className="max-h-[420px] overflow-y-auto">
          <div className="p-4 space-y-1 font-mono text-xs">
            {log.map((entry) => {
              const meta = STEP_META[entry.type] ?? { icon: Bot, color: "text-muted-foreground" };
              const Icon = meta.icon;
              const isSpinner = (entry.type === "context_start" || entry.type === "write_start" || entry.type === "planner_start") && running;

              return (
                <div key={entry.id} className="flex gap-2.5 py-1 animate-fade-in">
                  <Icon
                    className={cn(
                      "w-3.5 h-3.5 shrink-0 mt-0.5",
                      meta.color,
                      isSpinner && "animate-spin"
                    )}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <span className={cn("font-medium", meta.color)}>
                      {entry.message}
                    </span>
                    {entry.detail && (
                      <span className="ml-2 text-muted-foreground">
                        {entry.detail}
                      </span>
                    )}

                    {/* Batch shortfall inline detail */}
                    {entry.type === "batch_planned" && Array.isArray((entry.data as any)?.shortfalls) && (entry.data as any).shortfalls.length > 0 && (
                      <div className="mt-1 ml-1 flex flex-wrap gap-1">
                        {((entry.data as any).shortfalls as Array<{name:string;shortfallGrams:number}>).map((s, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {s.name}: {formatGrams(s.shortfallGrams)} shortfall
                          </span>
                        ))}
                      </div>
                    )}

                    {/* AI notes on complete */}
                    {entry.type === "complete" && (entry.data as any)?.aiNotes && (
                      <div className="mt-1.5 px-2 py-1.5 bg-blue-50 border border-blue-100 rounded text-blue-700 font-sans text-[11px] leading-relaxed">
                        <span className="font-semibold">AI reasoning: </span>
                        {(entry.data as any).aiNotes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!running && log.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          <Bot className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p className="font-medium">AI agent is standing by</p>
          <p className="text-xs mt-1 opacity-70">
            Click "Generate schedule" to watch the agent reason over your orders,
            stock levels, and oven capacity in real time.
          </p>
        </div>
      )}

      {/* ── Summary footer after completion ───────────────────────────────── */}
      {done && !hasError && (
        <div className="border-t border-border px-5 py-3 bg-green-50/50 flex items-center justify-between gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-1.5 text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-medium">
              {batchCount} batch{batchCount !== 1 ? "es" : ""} scheduled
            </span>
            <span className="text-green-600/70">
              · Scroll up to review and approve
            </span>
          </div>
          {scheduleId && (
            <span className="text-muted-foreground font-mono text-[10px]">
              id: {scheduleId.slice(-8)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
