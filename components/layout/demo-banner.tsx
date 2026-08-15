"use client";

/**
 * DemoBanner
 *
 * Shown at the very top of every dashboard page when APP_MODE=demo.
 * Makes it instantly clear to competition judges that this is a demo
 * environment, links to the sign-up page for the production version,
 * and shows a live task ticker so the background agent activity is
 * visible at all times.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bot, X, ExternalLink, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskTick {
  message: string;
  at:      string;
}

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [tick,      setTick]      = useState<TaskTick | null>(null);

  // Poll the task queue status every 15 seconds to show live agent activity
  useEffect(() => {
    let mounted = true;

    async function fetchLatest() {
      try {
        const res = await fetch("/api/agent/status");
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

        {/* Icon */}
        <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
          <Bot className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
        </div>

        {/* Main message */}
        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap text-xs">
          <span className="font-semibold text-amber-200 shrink-0">
            🏆 Competition Demo
          </span>
          <span className="text-amber-300/80 shrink-0 hidden sm:inline">
            BakeSync — Autonomous AI for commercial bakeries
          </span>

          {/* Live task ticker */}
          {tick && (
            <span className="flex items-center gap-1.5 text-amber-400/80 font-mono truncate max-w-[340px]">
              <Activity className="w-3 h-3 shrink-0 animate-pulse" aria-hidden="true" />
              <span className="truncate">{tick.message}</span>
              <span className="shrink-0 opacity-50">{tick.at}</span>
            </span>
          )}
        </div>

        {/* Production CTA */}
        <Link
          href="/signup"
          className={cn(
            "hidden sm:flex items-center gap-1.5 shrink-0",
            "text-[11px] font-semibold text-amber-900",
            "bg-amber-400 hover:bg-amber-300 transition-colors",
            "px-3 py-1.5 rounded-full"
          )}
        >
          Get full access
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </Link>

        {/* Dismiss */}
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
