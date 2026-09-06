"use client";

/**
 * AgentActivityFeed
 *
 * Client component that renders the live agent activity timeline.
 * Supports:
 *  - Mark alerts as read / dismiss
 *  - Run the proactive monitor manually (with live feedback)
 *  - Expand AgentAction details to show full reasoning JSON
 *  - Auto-refresh every 30s
 */

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, AlertTriangle, XCircle, Info,
  Clock, ChevronDown, ChevronUp, RefreshCw, Play,
  Loader2, Package, CalendarDays, Zap, ShoppingCart, X,
} from "lucide-react";
import { cn, formatDateTime, formatGrams } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentAlertRow {
  id:                string;
  type:              string;
  severity:          string;
  title:             string;
  message:           string;
  isRead:            boolean;
  isDismissed:       boolean;
  createdAt:         string;
  relatedEntityId:   string | null;
  relatedEntityType: string | null;
}

interface AgentActionRow {
  id:               string;
  type:             string;
  status:           string;
  summary:          string;
  details:          Record<string, unknown>;
  requiresApproval: boolean;
  triggeredAt:      string;
  completedAt:      string | null;
  errorMessage:     string | null;
}

interface AgentActivityFeedProps {
  initialAlerts:  AgentAlertRow[];
  initialActions: AgentActionRow[];
}

// ─── Icon / colour maps ───────────────────────────────────────────────────────

const SEVERITY_META: Record<string, { icon: React.ElementType; ring: string; bg: string; text: string }> = {
  CRITICAL: { icon: XCircle,       ring: "ring-red-200 dark:ring-red-900/50",       bg: "bg-red-50 dark:bg-red-950/40",       text: "text-red-700 dark:text-red-300"       },
  WARNING:  { icon: AlertTriangle, ring: "ring-yellow-200 dark:ring-yellow-900/50", bg: "bg-yellow-50 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-300" },
  INFO:     { icon: Info,          ring: "ring-blue-200 dark:ring-blue-900/50",     bg: "bg-blue-50 dark:bg-blue-950/40",     text: "text-blue-700 dark:text-blue-300"     },
};

const ACTION_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  GENERATE_SCHEDULE:          { icon: CalendarDays,  color: "text-purple-600", label: "Schedule"     },
  FLAG_SHORTFALL:             { icon: Package,       color: "text-orange-600", label: "Monitor"      },
  PROCUREMENT_RECOMMENDATION: { icon: ShoppingCart,  color: "text-blue-600",   label: "Procurement"  },
  DEMAND_FORECAST:            { icon: Zap,           color: "text-green-600",  label: "Forecast"     },
  WASTE_ALERT:                { icon: AlertTriangle, color: "text-yellow-600", label: "Waste"        },
  EXPIRY_ALERT:               { icon: Clock,         color: "text-red-500",    label: "Expiry"       },
  SCHEDULE_OVERRIDE:          { icon: RefreshCw,     color: "text-indigo-600", label: "Override"     },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  COMPLETED: { color: "text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-950/40",  label: "Done"    },
  RUNNING:   { color: "text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40",      label: "Running" },
  PENDING:   { color: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40",  label: "Queued"  },
  FAILED:    { color: "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/40",          label: "Failed"  },
  DISMISSED: { color: "text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-800/50",      label: "Skipped" },
};

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentActivityFeed({
  initialAlerts,
  initialActions,
}: AgentActivityFeedProps) {
  const router = useRouter();

  const [alerts,  setAlerts]  = useState(initialAlerts);
  const [actions, setActions] = useState(initialActions);
  const [tab,     setTab]     = useState<"all" | "alerts" | "actions">("all");
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [monitorRunning, setMonitorRunning] = useState(false);
  const [monitorResult,  setMonitorResult]  = useState<string | null>(null);
  const [dismissing, startDismiss] = useTransition();

  // ── Auto-refresh so the feed + header KPI counts stay live ───────────────
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(id);
  }, [router]);

  // ── Dismiss an alert ─────────────────────────────────────────────────────
  function dismissAlert(id: string) {
    startDismiss(async () => {
      const res = await fetch("/api/alerts", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids: [id] }),
      });
      if (res.ok) {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }
    });
  }

  // ── Mark all as read ─────────────────────────────────────────────────────
  async function markAllRead() {
    const unread = alerts.filter(a => !a.isRead).map(a => a.id);
    if (!unread.length) return;
    await fetch("/api/alerts", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ids: unread }),
    });
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  }

  // ── Run monitor ──────────────────────────────────────────────────────────
  async function runMonitor() {
    setMonitorRunning(true);
    setMonitorResult(null);
    try {
      const res = await fetch("/api/agent/monitor", { method: "POST" });
      const json = await res.json();
      const r = json.data?.results?.[0];
      if (r) {
        const items: string[] = Array.isArray(r.summary) ? r.summary : [];
        const outstanding = Number(r.outstandingIssues ?? 0);
        if (items.length > 0) {
          // New findings this run — list them.
          setMonitorResult(
            `Monitor found ${items.length} thing${items.length !== 1 ? "s" : ""} to act on:\n` +
            items.map((s) => `• ${s}`).join("\n")
          );
        } else if (outstanding > 0) {
          // Nothing NEW, but issues are still open — don't claim "all clear".
          setMonitorResult(
            `Monitor ran — no new issues, but ${outstanding} alert${outstanding !== 1 ? "s" : ""} still need attention. Review the list below.`
          );
        } else {
          setMonitorResult("Monitor ran — everything's on track. No new issues. ✓");
        }
      } else {
        setMonitorResult("Monitor ran — everything's on track. ✓");
      }
      router.refresh();
    } finally {
      setMonitorRunning(false);
    }
  }

  // ── Merged timeline ──────────────────────────────────────────────────────
  type TimelineItem =
    | { kind: "alert";  ts: number; data: AgentAlertRow  }
    | { kind: "action"; ts: number; data: AgentActionRow };

  const timeline: TimelineItem[] = [
    ...alerts.map(a  => ({ kind: "alert"  as const, ts: new Date(a.createdAt).getTime(),   data: a })),
    ...actions.map(a => ({ kind: "action" as const, ts: new Date(a.triggeredAt).getTime(), data: a })),
  ].sort((a, b) => b.ts - a.ts);

  const filtered = timeline.filter(item => {
    if (tab === "alerts")  return item.kind === "alert";
    if (tab === "actions") return item.kind === "action";
    return true;
  });

  const unreadCount = alerts.filter(a => !a.isRead).length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Control bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Tab pills */}
          {(["all", "alerts", "actions"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                tab === t
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
              {t === "alerts" && unreadCount > 0 && (
                <span className="ml-1.5 bg-destructive text-white rounded-full text-[10px] px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            loading={monitorRunning}
            onClick={runMonitor}
            leftIcon={monitorRunning ? undefined : <Play className="w-3.5 h-3.5" />}
          >
            Run monitor now
          </Button>
        </div>
      </div>

      {/* Monitor result banner */}
      {monitorResult && (
        <div className="px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-foreground text-sm flex items-start gap-2">
          <Bot className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <span className="whitespace-pre-line leading-relaxed">{monitorResult}</span>
        </div>
      )}

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Bot className="w-12 h-12 mx-auto text-muted-foreground/20" />
          <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Run the monitor or generate a production schedule to see the agent's
            reasoning trail appear here.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical spine */}
          <div
            className="absolute left-[18px] top-6 bottom-0 w-px bg-border"
            aria-hidden="true"
          />

          <ul className="space-y-3" role="list">
            {filtered.map((item) => (
              <li key={`${item.kind}-${item.data.id}`} className="flex gap-4">

                {/* ── Timeline dot ──────────────────────────────────────── */}
                <div className="shrink-0 w-9 h-9 mt-0.5 flex items-center justify-center z-10">
                  {item.kind === "alert" ? (
                    <AlertDot alert={item.data} />
                  ) : (
                    <ActionDot action={item.data} />
                  )}
                </div>

                {/* ── Card ──────────────────────────────────────────────── */}
                <div className="flex-1 min-w-0 pb-2">
                  {item.kind === "alert" ? (
                    <AlertCard
                      alert={item.data}
                      onDismiss={dismissAlert}
                    />
                  ) : (
                    <ActionCard
                      action={item.data}
                      expanded={expandedAction === item.data.id}
                      onToggle={() =>
                        setExpandedAction(v => v === item.data.id ? null : item.data.id)
                      }
                    />
                  )}
                </div>

              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Alert dot ────────────────────────────────────────────────────────────────

function AlertDot({ alert }: { alert: AgentAlertRow }) {
  const meta = SEVERITY_META[alert.severity] ?? SEVERITY_META.INFO;
  const Icon = meta.icon;
  return (
    <div className={cn(
      "w-9 h-9 rounded-full ring-2 flex items-center justify-center",
      meta.bg, meta.ring,
      !alert.isRead && "shadow-sm"
    )}>
      <Icon className={cn("w-4 h-4", meta.text)} aria-hidden="true" />
    </div>
  );
}

// ─── Action dot ───────────────────────────────────────────────────────────────

function ActionDot({ action }: { action: AgentActionRow }) {
  const meta = ACTION_META[action.type] ?? { icon: Bot, color: "text-primary" };
  const Icon = meta.icon;
  return (
    <div className="w-9 h-9 rounded-full ring-2 ring-border bg-card flex items-center justify-center">
      <Icon className={cn("w-4 h-4", meta.color)} aria-hidden="true" />
    </div>
  );
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onDismiss,
}: {
  alert: AgentAlertRow;
  onDismiss: (id: string) => void;
}) {
  const meta = SEVERITY_META[alert.severity] ?? SEVERITY_META.INFO;
  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      meta.bg,
      `ring-1 ${meta.ring}`,
      !alert.isRead && "shadow-sm"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-sm font-semibold", meta.text)}>
              {alert.title}
            </p>
            {!alert.isRead && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Unread" />
            )}
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
              meta.bg, meta.text
            )}>
              {alert.severity}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {alert.message}
          </p>
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">
            {formatDateTime(alert.createdAt)}
            {alert.relatedEntityType && ` · ${alert.relatedEntityType}`}
          </p>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className="p-1 rounded-lg hover:bg-black/10 transition-colors shrink-0 tap-target"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5 opacity-50" />
        </button>
      </div>
    </div>
  );
}

// ─── Action card ──────────────────────────────────────────────────────────────

function ActionCard({
  action,
  expanded,
  onToggle,
}: {
  action:   AgentActionRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta   = ACTION_META[action.type] ?? { icon: Bot, color: "text-primary", label: "Action" };
  const status = STATUS_META[action.status] ?? { color: "text-muted-foreground bg-muted", label: action.status };
  const hasDetails = Object.keys(action.details ?? {}).length > 0;

  // Pretty-format duration
  let duration = "";
  if (action.completedAt && action.triggeredAt) {
    // Clamp to >= 0: DB timestamp rounding can make completedAt land a hair
    // before triggeredAt, which would otherwise render as a bogus "-1ms".
    const ms = Math.max(0, new Date(action.completedAt).getTime() - new Date(action.triggeredAt).getTime());
    duration = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
              status.color
            )}>
              {status.label}
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {meta.label}
            </span>
            {duration && (
              <span className="text-[10px] text-muted-foreground">
                {duration}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground leading-snug">{action.summary}</p>
          {action.errorMessage && (
            <p className="mt-1 text-xs text-destructive">{action.errorMessage}</p>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            {formatDateTime(action.triggeredAt)}
          </p>
        </div>

        {hasDetails && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0 text-muted-foreground tap-target"
            aria-label={expanded ? "Collapse details" : "Expand reasoning"}
            aria-expanded={expanded}
          >
            {expanded
              ? <ChevronUp   className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />
            }
          </button>
        )}
      </div>

      {/* ── Expanded details / reasoning ──────────────────────────────── */}
      {expanded && hasDetails && (
        <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Agent reasoning & details
          </p>

          {/* Deductions summary (schedule approval) */}
          {Array.isArray((action.details as any)?.deductions) && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Stock deductions</p>
              <div className="space-y-1">
                {((action.details as any).deductions as Array<{
                  name: string; deductedGrams: number; newStockGrams: number; alertLevel: string;
                }>).map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-foreground">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">−{formatGrams(d.deductedGrams)}</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                        d.alertLevel === "OK"           ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"  :
                        d.alertLevel === "LOW"          ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300" :
                        d.alertLevel === "CRITICAL"     ? "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300":
                        "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      )}>
                        {d.alertLevel.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monitor summary */}
          {Array.isArray((action.details as any)?.summary) &&
           (action.details as any).summary.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Monitor findings</p>
              <ul className="space-y-0.5">
                {((action.details as any).summary as string[]).map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground">{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AI notes (schedule generation) */}
          {(action.details as any)?.aiNotes && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">AI reasoning</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {(action.details as any).aiNotes}
              </p>
            </div>
          )}

          {/* Raw JSON fallback for other action types */}
          {!(action.details as any)?.deductions &&
           !(action.details as any)?.summary &&
           !(action.details as any)?.aiNotes && (
            <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {JSON.stringify(action.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
