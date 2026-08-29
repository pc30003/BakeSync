"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ScheduleWatcherProps {
  /** Whether an approved schedule is currently displayed */
  hasSchedule: boolean;
}

/**
 * Watches for schedule approval/revocation changes and refreshes the page
 * ONLY when the approved-schedule state actually flips. It never refreshes
 * on every poll, so it won't interfere with checklist ticking mid-work.
 */
export function ScheduleWatcher({ hasSchedule }: ScheduleWatcherProps) {
  const router = useRouter();
  const lastKnown = useRef(hasSchedule);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/schedules?approved=true");
        if (!res.ok) return;
        const json = await res.json();

        const now = new Date();
        const approvedToday = (json.data ?? []).some((s: any) => {
          const d = new Date(s.scheduleDate);
          return d.getUTCFullYear() === now.getUTCFullYear()
            && d.getUTCMonth() === now.getUTCMonth()
            && d.getUTCDate() === now.getUTCDate();
        });

        // Only refresh when the state ACTUALLY changes:
        //   - no schedule → approved (schedule appears)
        //   - approved → revoked (schedule disappears)
        if (approvedToday !== lastKnown.current) {
          lastKnown.current = approvedToday;
          router.refresh();
        }
      } catch {
        // silent
      }
    }, 2000);

    return () => clearInterval(id);
  }, [router]);

  return null;
}
