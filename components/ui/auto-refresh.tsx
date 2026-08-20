"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  interval?: number; // ms, default 3000
}

/**
 * Invisible component that calls router.refresh() on a timer.
 * Add to any server component page that needs live data updates.
 */
export function AutoRefresh({ interval = 3000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, interval);

    return () => clearInterval(id);
  }, [router, interval]);

  return null;
}
