"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShiftClockProps {
  openingTime: string;  // "HH:mm"
  closingTime: string;  // "HH:mm"
}

/**
 * Live clock showing current time and whether the kitchen is currently
 * within operating hours. Purely visual — reads bakery hours from props.
 */
export function ShiftClock({ openingTime, closingTime }: ShiftClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <div className="hidden md:block w-32 h-8" aria-hidden="true" />;
  }

  // Determine if kitchen is open
  const [openH, openM] = openingTime.split(":").map(Number);
  const [closeH, closeM] = closingTime.split(":").map(Number);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const isOpen = minutesNow >= openMinutes && minutesNow < closeMinutes;

  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-muted/50">
      <Clock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm font-medium tabular-nums text-foreground">{timeStr}</span>
      <span className="w-px h-4 bg-border" aria-hidden="true" />
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            isOpen ? "bg-green-500 animate-pulse" : "bg-gray-400"
          )}
          aria-hidden="true"
        />
        <span className={cn("text-xs font-medium", isOpen ? "text-green-600" : "text-muted-foreground")}>
          {isOpen ? "Kitchen Open" : "Closed"}
        </span>
      </span>
    </div>
  );
}
