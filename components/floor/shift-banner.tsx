"use client";

import { useState, useEffect } from "react";
import { getCurrentShift, getNextShift } from "@/lib/shifts";

/**
 * Live shift banner shown at the top of the Floor Staff page.
 * Shows the current shift, its time window, and a countdown to the next shift.
 * Updates every minute.
 */
export function ShiftBanner() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000); // update every 30s
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <div className="h-16 rounded-xl bg-muted/40 animate-pulse" aria-hidden="true" />;
  }

  const current = getCurrentShift(now);
  const { shift: next, minutesUntil } = getNextShift(now);

  const hours = Math.floor(minutesUntil / 60);
  const mins  = minutesUntil % 60;
  const countdown = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl" role="img" aria-hidden="true">{current.icon}</span>
        <div>
          <p className="text-sm font-bold text-foreground">{current.label}</p>
          <p className="text-xs text-muted-foreground">
            {current.startTime} — {current.endTime} · Active now
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Next shift</p>
        <p className="text-sm font-medium text-foreground">
          {next.icon} {next.label.replace(" Shift", "")} in {countdown}
        </p>
      </div>
    </div>
  );
}
