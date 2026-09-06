"use client";

/**
 * RelativeTime
 *
 * Renders a live "x minutes ago" label that re-ticks on its own, so timestamps
 * like "last restocked" stay accurate without waiting for a server refresh.
 *
 * Hydration-safe: renders the same absolute fallback on the server and the
 * client's first paint, then updates to the relative label after mount.
 */

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

export function RelativeTime({
  date,
  addSuffix = true,
  intervalMs = 30_000,
  fallback = "—",
}: {
  date: string | number | Date | null | undefined;
  addSuffix?: boolean;
  intervalMs?: number;
  fallback?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (date == null) {
      setLabel(null);
      return;
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      setLabel(null);
      return;
    }

    const update = () => setLabel(formatDistanceToNow(d, { addSuffix }));
    update();
    const id = setInterval(update, intervalMs);
    return () => clearInterval(id);
  }, [date, addSuffix, intervalMs]);

  // Before mount (SSR + first client paint) render the fallback so the markup
  // matches and there's no hydration mismatch.
  return <>{label ?? fallback}</>;
}
