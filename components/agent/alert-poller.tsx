"use client";

import { useEffect, useRef } from "react";
import { showToast } from "@/components/ui/toast-notification";

/**
 * Polls /api/alerts?unread=true every 5 seconds.
 * When new alerts appear that weren't there before, shows a toast notification.
 * Also polls for newly approved schedules to notify floor staff.
 */
export function AlertPoller() {
  const knownAlertIds = useRef<Set<string>>(new Set());
  const knownScheduleIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        // Poll alerts
        const alertRes = await fetch("/api/alerts?unread=true");
        if (alertRes.ok) {
          const json = await alertRes.json();
          const alerts = json.data ?? [];

          if (!initialized.current) {
            for (const alert of alerts) {
              knownAlertIds.current.add(alert.id);
            }
          } else {
            for (const alert of alerts) {
              if (!knownAlertIds.current.has(alert.id)) {
                knownAlertIds.current.add(alert.id);
                if (mounted) {
                  showToast({
                    title: alert.title,
                    message: alert.message?.slice(0, 80) + (alert.message?.length > 80 ? "…" : ""),
                    severity: alert.severity === "CRITICAL" ? "CRITICAL"
                            : alert.severity === "WARNING"  ? "WARNING"
                            : "INFO",
                    duration: 6000,
                  });
                }
              }
            }
          }
        }

        // Poll for approved schedules (for floor staff)
        const schedRes = await fetch("/api/schedules?approved=true");
        if (schedRes.ok) {
          const json = await schedRes.json();
          const schedules = json.data ?? [];

          if (!initialized.current) {
            for (const s of schedules) {
              knownScheduleIds.current.add(s.id);
            }
            initialized.current = true;
          } else {
            for (const s of schedules) {
              if (!knownScheduleIds.current.has(s.id)) {
                knownScheduleIds.current.add(s.id);
                if (mounted) {
                  showToast({
                    title: "New schedule approved",
                    message: `${s.shiftType} shift schedule is now live. Check your shift page for your checklist.`,
                    severity: "SUCCESS",
                    duration: 8000,
                  });
                }
              }
            }
          }
        }
      } catch {
        // Silent fail
      }
    }

    poll();
    const id = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return null;
}
