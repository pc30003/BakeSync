"use client";

import { useState, useTransition } from "react";
import { CheckSquare, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItemData {
  id: string;
  description: string;
  status: string;
  order: number;
  notes: string | null;
}

interface FloorShiftChecklistProps {
  scheduleId: string;
  batchId: string;
  initialItems: ChecklistItemData[];
}

export function FloorShiftChecklist({ scheduleId, batchId, initialItems }: FloorShiftChecklistProps) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const done = items.filter((i) => i.status === "DONE").length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function toggle(item: ChecklistItemData) {
    const newStatus = item.status === "DONE" ? "PENDING" : "DONE";
    setUpdatingId(item.id);

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/schedules/${scheduleId}/batches/${batchId}/checklist`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: item.id, status: newStatus }),
          }
        );

        if (res.ok) {
          if (newStatus === "PENDING") {
            // Unchecking — also revert all subsequent steps to PENDING
            setItems((prev) =>
              prev.map((i) => i.order >= item.order ? { ...i, status: "PENDING" } : i)
            );
            // Also revert subsequent steps on the server
            const subsequentItems = items.filter((i) => i.order > item.order && i.status === "DONE");
            for (const sub of subsequentItems) {
              await fetch(
                `/api/schedules/${scheduleId}/batches/${batchId}/checklist`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ itemId: sub.id, status: "PENDING" }),
                }
              );
            }
          } else {
            setItems((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i))
            );
          }
        }
      } finally {
        setUpdatingId(null);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="px-5 py-4 text-sm text-muted-foreground">
        No checklist steps for this batch.
      </div>
    );
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>{done}/{total} steps completed</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="divide-y divide-border" role="list" aria-label="Batch checklist">
      {items.map((item, index) => {
        const isDone    = item.status === "DONE";
        const isLoading = updatingId === item.id && isPending;

        // Item is locked if any previous item is not DONE or SKIPPED
        const isLocked = index > 0 && items.slice(0, index).some(
          (prev) => prev.status !== "DONE" && prev.status !== "SKIPPED"
        );

        return (
          <li key={item.id}>
            <button
              onClick={() => !isLocked && toggle(item)}
              disabled={isLoading || isLocked}
              className={cn(
                "w-full flex items-center gap-3 px-5 py-3.5 text-left tap-target",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isDone && "opacity-60",
                isLocked
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-muted/50"
              )}
              aria-pressed={isDone}
              aria-disabled={isLocked}
              aria-label={isLocked ? `Locked: ${item.description}` : `${isDone ? "Unmark" : "Complete"}: ${item.description}`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
              ) : isDone ? (
                <CheckSquare className="w-5 h-5 shrink-0 text-primary" aria-hidden="true" />
              ) : isLocked ? (
                <Square className="w-5 h-5 shrink-0 text-muted-foreground/40" aria-hidden="true" />
              ) : (
                <Square className="w-5 h-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className={cn("text-sm", isDone && "line-through", isLocked && "text-muted-foreground")}>
                {item.description}
              </span>
              {isLocked && (
                <span className="ml-auto text-[10px] text-muted-foreground/60 shrink-0">
                  Complete previous step first
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
    </div>
  );
}
