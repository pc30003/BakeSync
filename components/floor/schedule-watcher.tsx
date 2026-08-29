"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ScheduleWatcherProps {
  /** Whether an approved schedule is currently displayed */
  hasSchedule: boolean;
}

/**
 * Only refreshes the page when the floor staff is WAITING for a schedule
 * (no approved schedule shown yet). Once a schedule appears, it stops
 * refreshing so it never interferes with checklist tick state.
 */
export function ScheduleWatcher({ hasSchedule }: ScheduleWatcherProps) {
  const router = useRouter();
  const lastState = useRef(hasSchedule);

  useEffect(() => {
    // If a schedule is already showing, do nothing — protect the checklist state
    if (hasSchedule) return;

    // No schedule yet — poll for one every 2 seconds
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/schedules?approved=true");
        if (!res.ok) return;
        const json = await res.json();
        const approvedToday = (json.data ?? []).some((s: any) => {
          const d = new Date(s.scheduleDate);
          const now = new Date();
          return d.getUTCFullYear() === now.getUTCFullYear()
            && d.getUTCMonth() === now.getUTCMonth()
            && d.getUTCDate() === now.getUTCDate();
        });

        // A schedule just got approved — refresh once to load it
        if (approvedToday && !lastState.current) {
          router.refresh();
        }
      } catch {
        // silent
      }
    }, 2000);

    return () => clearInterval(id);
  }, [hasSchedule, router]);
  // Polls every 2s while waiting for a schedule

  return null;
}
