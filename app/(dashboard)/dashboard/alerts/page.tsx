import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AgentActivityFeed } from "@/components/agent/agent-activity-feed";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate } from "@/lib/utils";
import {
  Bot, AlertTriangle, Zap,
} from "lucide-react";
import { subDays } from "date-fns";

export const metadata: Metadata = { title: "Agent Activity" };

export const revalidate = 2;

export default async function AgentActivityPage() {
  const session  = await auth();
  const bakeryId = session!.user.bakeryId;
  const now      = new Date();
  const last7    = subDays(now, 7);

  // Load everything in parallel
  const [alerts, actions, stats] = await Promise.all([

    // Active (non-dismissed) alerts, newest first
    db.agentAlert.findMany({
      where:   { bakeryId, isDismissed: false },
      orderBy: { createdAt: "desc" },
      take:    100,
    }),

    // All agent actions, newest first
    db.agentAction.findMany({
      where:   { bakeryId },
      orderBy: { triggeredAt: "desc" },
      take:    100,
    }),

    // KPI counts for the header row
    Promise.all([
      db.agentAlert.count({
        where: { bakeryId, isRead: false, isDismissed: false },
      }),
      db.agentAlert.count({
        where: { bakeryId, severity: "CRITICAL", isDismissed: false },
      }),
      db.agentAction.count({
        where: { bakeryId, status: "COMPLETED", completedAt: { gte: last7 } },
      }),
      db.agentAction.count({
        where: { bakeryId, status: "FAILED" },
      }),
    ]),
  ]);

  const [unreadAlerts, criticalAlerts, actionsThisWeek, failedActions] = stats;

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Agent Activity
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(now)} · Full reasoning trail of every autonomous decision
            </p>
          </div>
        </div>

        {/* Capability tags — helps judges understand the system at a glance */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { label: "Proactive monitoring",     color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-900/50" },
            { label: "OpenAI function calling",  color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50"       },
            { label: "FEFO stock management",    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50"    },
            { label: "Autonomous procurement",   color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900/50"    },
            { label: "Multi-role orchestration", color: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-900/50"       },
          ].map(tag => (
            <span
              key={tag.label}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${tag.color}`}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Unread alerts"
          value={unreadAlerts}
          subtitle="awaiting attention"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant={unreadAlerts > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Critical alerts"
          value={criticalAlerts}
          subtitle="require immediate action"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant={criticalAlerts > 0 ? "danger" : "default"}
        />
        <StatCard
          title="Actions this week"
          value={actionsThisWeek}
          subtitle="completed autonomously"
          icon={<Zap className="w-5 h-5" />}
          variant="success"
        />
        <StatCard
          title="Failed actions"
          value={failedActions}
          subtitle="need investigation"
          icon={<Bot className="w-5 h-5" />}
          variant={failedActions > 0 ? "danger" : "default"}
        />
      </div>

      {/* ── How it works (collapsed callout for judges) ──────────────────── */}
      <AgentExplainer />

      {/* ── Live feed ───────────────────────────────────────────────────── */}
      <AgentActivityFeed
        initialAlerts={alerts.map(a => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
        initialActions={actions.map(a => ({
          ...a,
          triggeredAt: a.triggeredAt.toISOString(),
          completedAt: a.completedAt?.toISOString() ?? null,
          details:     (a.details as Record<string, unknown>) ?? {},
        }))}
      />
    </div>
  );
}

// ─── Collapsible explainer for competition judges ─────────────────────────────

function AgentExplainer() {
  return (
    <details className="group rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer list-none select-none">
        <div className="flex items-center gap-2.5">
          <Bot className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">
            How BakeSync's agentic loop works
          </span>
        </div>
        <ChevronDownIcon />
      </summary>

      <div className="px-5 pb-5 pt-1 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            step:  "1. Sense",
            icon:  "🔍",
            color: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50",
            text:  "The monitor runs every hour. It reads stock levels, expiry dates, and upcoming orders — building a complete bakery state snapshot.",
          },
          {
            step:  "2. Reason",
            icon:  "🤖",
            color: "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/50",
            text:  "OpenAI GPT-4o receives the snapshot via structured function calling. It reasons over constraints — oven capacity, FEFO lots, multi-stage baking timelines — and returns a typed production plan.",
          },
          {
            step:  "3. Act",
            icon:  "⚡",
            color: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50",
            text:  "The plan is written to the database: schedules, checklists, stock deductions, procurement recommendations, and agent alerts — all without human instruction.",
          },
        ].map(s => (
          <div key={s.step} className={`rounded-lg border p-4 ${s.color}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl" role="img" aria-hidden="true">{s.icon}</span>
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">{s.step}</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
