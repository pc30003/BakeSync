"use client";

import { useState, useEffect } from "react";
import { Bot, X, Activity, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskTick {
  message: string;
  at:      string;
}

// Reset happens at 02:00 UTC daily
function getLocalResetTime(): string {
  try {
    const now = new Date();
    const resetUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      2, 0, 0
    ));
    return resetUTC.toLocaleTimeString(undefined, {
      hour:         "2-digit",
      minute:       "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "2:00 AM UTC";
  }
}

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [tick,      setTick]      = useState<TaskTick | null>(null);
  const [resetTime, setResetTime] = useState<string>("");

  useEffect(() => {
    setResetTime(getLocalResetTime());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function fetchLatest() {
      try {
        const res  = await fetch("/api/agent/status");
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json.data?.latest) {
          setTick({ message: json.data.latest, at: new Date().toLocaleTimeString("en-GB") });
        }
      } catch { /* silent */ }
    }

    fetchLatest();
    const id = setInterval(fetchLatest, 15_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "relative z-50 w-full",
        "bg-gradient-to-r from-[#78350F] via-[#92400E] to-[#78350F]",
        "text-amber-100"
      )}
      role="banner"
      aria-label="Demo environment notice"
    >
      <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center gap-3">

        <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
          <Bot className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap text-xs">
          <span className="font-semibold text-amber-200 shrink-0">
            🏆 Competition Demo
          </span>
          <span className="text-amber-300/80 shrink-0 hidden sm:inline">
            BakeSync — Autonomous AI for commercial bakeries
          </span>

          {resetTime && (
            <span className="flex items-center gap-1 text-amber-400/70 shrink-0">
              <Clock className="w-3 h-3" aria-hidden="true" />
              <span>Resets daily at {resetTime}</span>
            </span>
          )}

          {tick && (
            <span className="flex items-center gap-1.5 text-amber-400/80 font-mono truncate max-w-[340px]">
              <Activity className="w-3 h-3 shrink-0 animate-pulse" aria-hidden="true" />
              <span className="truncate">{tick.message}</span>
              <span className="shrink-0 opacity-50">{tick.at}</span>
            </span>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-white/10 transition-colors shrink-0 tap-target"
          aria-label="Dismiss demo banner"
        >
          <X className="w-3.5 h-3.5 text-amber-300/60" />
        </button>
      </div>
    </div>
  );
}
