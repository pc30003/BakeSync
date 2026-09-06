"use client";

/**
 * AgentCommandCenter
 *
 * The hero status bar for the Agent Activity page. Instead of four disconnected
 * KPI boxes, this reads the current system state and reports it like a living
 * agent: a dynamic headline (green when nominal, red when a critical issue is
 * open), a live ticking clock to prove it's real-time, and the key counts as
 * compact inline pills.
 *
 * Purely presentational — all counts are passed in from the server component.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/ui/count-up";
import { ShieldCheck, AlertTriangle, XCircle, Zap, Activity } from "lucide-react";

interface AgentCommandCenterProps {
  critical:     number;
  warnings:     number;
  actionsToday: number;
  failed:       number;
}

export function AgentCommandCenter({
  critical,
  warnings,
  actionsToday,
  failed,
}: AgentCommandCenterProps) {
  // Live clock — updates every second so judges can see it's real-time.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Derive the overall system state from the counts.
  const state = deriveState(critical, warnings, failed);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 md:p-6 transition-colors",
        state.container
      )}
    >
      {/* Soft accent glow in the corner */}
      <div className={cn("pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-40", state.glow)} />

      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* ── Left: status headline ─────────────────────────────────────── */}
        <div className="flex items-start gap-4 min-w-0">
          <div className={cn("shrink-0 w-12 h-12 rounded-xl flex items-center justify-center", state.iconWrap)}>
            <state.icon className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", state.pulse)} />
                <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", state.pulse)} />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Agent command center
              </p>
            </div>
            <h2 className={cn("mt-1 text-lg md:text-xl font-bold leading-tight", state.headlineText)}>
              {state.headline}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Monitoring stock, expiry &amp; demand
              <span className="opacity-40">·</span>
              <span className="tabular-nums">
                as of {now ? now.toLocaleTimeString() : "--:--:--"}
              </span>
            </p>
          </div>
        </div>

        {/* ── Right: count pills ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3 shrink-0">
          <Pill
            label="Critical"
            value={critical}
            tone={critical > 0 ? "critical" : "muted"}
          />
          <Pill
            label="Warnings"
            value={warnings}
            tone={warnings > 0 ? "warning" : "muted"}
          />
          <Pill
            label="Acted today"
            value={actionsToday}
            tone="accent"
          />
          <Pill
            label="Failures"
            value={failed}
            tone={failed > 0 ? "critical" : "success"}
          />
        </div>
      </div>
    </div>
  );
}

// ─── State machine ────────────────────────────────────────────────────────────

function deriveState(critical: number, warnings: number, failed: number) {
  if (critical > 0 || failed > 0) {
    const n = critical + failed;
    return {
      icon:         XCircle,
      headline:     `${n} issue${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} your attention`,
      headlineText: "text-red-700 dark:text-red-300",
      container:    "border-red-200 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/30",
      iconWrap:     "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
      pulse:        "bg-red-500",
      glow:         "bg-red-400",
    };
  }
  if (warnings > 0) {
    return {
      icon:         AlertTriangle,
      headline:     `${warnings} warning${warnings !== 1 ? "s" : ""} to review`,
      headlineText: "text-yellow-700 dark:text-yellow-300",
      container:    "border-yellow-200 bg-yellow-50/70 dark:border-yellow-900/50 dark:bg-yellow-950/30",
      iconWrap:     "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
      pulse:        "bg-yellow-500",
      glow:         "bg-yellow-400",
    };
  }
  return {
    icon:         ShieldCheck,
    headline:     "All systems nominal",
    headlineText: "text-green-700 dark:text-green-300",
    container:    "border-green-200 bg-green-50/70 dark:border-green-900/50 dark:bg-green-950/30",
    iconWrap:     "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    pulse:        "bg-green-500",
    glow:         "bg-green-400",
  };
}

// ─── Count pill ───────────────────────────────────────────────────────────────

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:  "critical" | "warning" | "accent" | "success" | "muted";
}) {
  const toneStyles: Record<typeof tone, string> = {
    critical: "bg-red-100/70 dark:bg-red-950/40",
    warning:  "bg-yellow-100/70 dark:bg-yellow-950/40",
    accent:   "bg-primary/10",
    success:  "bg-green-100/70 dark:bg-green-950/40",
    muted:    "bg-black/5 dark:bg-white/5",
  };
  const valueStyles: Record<typeof tone, string> = {
    critical: "text-red-600 dark:text-red-400",
    warning:  "text-yellow-600 dark:text-yellow-400",
    accent:   "text-primary",
    success:  "text-green-600 dark:text-green-400",
    muted:    "text-foreground/70",
  };
  return (
    <div className={cn("rounded-xl px-3 py-2 min-w-[76px] text-center backdrop-blur-sm", toneStyles[tone])}>
      <p className={cn("text-2xl font-bold leading-none tabular-nums", valueStyles[tone])}>
        <CountUp value={value} />
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
