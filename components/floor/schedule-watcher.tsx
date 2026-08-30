"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCurrentShift } from "@/lib/shifts";

interface ScheduleWatcherProps {
  /** Whether an approved schedule for the current shift is displayed */
  hasSchedule: boolean;
}

/**
 * Watches for approval/revocation changes for the CURRENT shift's schedule
 * and refreshes ONLY when that state flips. It also refreshes when the shift
 * window itself changes (e.g. Morning → Afternoon), so staff always see the
 * schedule for the shift they're actually in. Never refreshes on every poll,
 * so it won't interfere with checklist ticking mid-work.
 */
export function ScheduleWatcher({ hasSchedule }: ScheduleWatcherProps) {
  const router = useRouter();
  const lastKnown = useRef(hasSchedule);
  const lastShift = useRef(getCurrentShift().type);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        // 1. Detect shift window change (Morning → Afternoon etc.)
        const nowShift = getCurrentShift().type;
        if (nowShift !== lastShift.current) {
          lastShift.current = nowShift;
          router.refresh();
          return;
        }

        // 2. Detect the current shift's schedule appearing/disappearing
        const res = await fetch("/api/schedules?approved=true");
        if (!res.ok) return;
        const json = await res.json();

        const now = new Date();
        const approvedForCurrentShift = (json.data ?? []).some((s: any) => {
          const d = new Date(s.scheduleDate);
          const sameDay =
            d.getUTCFullYear() === now.getUTCFullYear() &&
            d.getUTCMonth() === now.getUTCMonth() &&
            d.getUTCDate() === now.getUTCDate();
          return sameDay && s.shiftType === nowShift;
        });

        if (approvedForCurrentShift !== lastKnown.current) {
          lastKnown.current = approvedForCurrentShift;
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
