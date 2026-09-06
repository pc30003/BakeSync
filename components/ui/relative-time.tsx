"use client";

/**
 * RelativeTime
 *
 * Renders a live "ago" label that re-ticks every second, so timestamps like
 * "last restocked" visibly count up in real time — "just now" -> "12s ago"
 * -> "1 min ago" -> "2 min ago" -> "1 hr ago" -> "3 days ago".
 *
 * Uses a seconds-aware formatter (not date-fns' minute-granularity
 * formatDistanceToNow) so the label actually changes while you watch it.
 *
 * Hydration-safe: renders the `fallback` on the server and the client's first
 * paint, then fills in the live label after mount.
 */

import { useEffect, useState } from "react";

export function RelativeTime({
  date,
  intervalMs = 1_000,
  fallback = "—",
}: {
  date: string | number | Date | null | undefined;
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

    const update = () => setLabel(formatAgo(d));
    update();
    const id = setInterval(update, intervalMs);
    return () => clearInterval(id);
  }, [date, intervalMs]);

  // Before mount (SSR + first client paint) render the fallback so the markup
  // matches and there's no hydration mismatch.
  return <>{label ?? fallback}</>;
}

// Seconds-aware "time ago" formatter.
function formatAgo(then: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));

  if (secs < 5)      return "just now";
  if (secs < 60)     return `${secs}s ago`;

  const mins = Math.floor(secs / 60);
  if (mins < 60)     return `${mins} min ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24)      return `${hrs} hr${hrs !== 1 ? "s" : ""} ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7)      return `${days} day${days !== 1 ? "s" : ""} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5)     return `${weeks} wk${weeks !== 1 ? "s" : ""} ago`;

  const months = Math.floor(days / 30);
  if (months < 12)   return `${months} mo ago`;

  const years = Math.floor(days / 365);
  return `${years} yr${years !== 1 ? "s" : ""} ago`;
}
