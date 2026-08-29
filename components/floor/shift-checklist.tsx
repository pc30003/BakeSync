"use client";

import { useState } from "react";
import { CheckSquare, Square, Loader2 } from "lucide-react";
import { cn, formatGrams } from "@/lib/utils";

interface DeductionData {
  ingredientId: string;
  deductionGrams: number;
  ingredient: { name: string };
}

interface ChecklistItemData {
  id: string;
  description: string;
  status: string;
  order: number;
  notes: string | null;
  ingredientId?: string | null;
  deductionGrams?: number | null;
  ingredient?: { name: string } | null;
  deductions?: DeductionData[];
}

interface FloorShiftChecklistProps {
  scheduleId: string;
  batchId: string;
  initialItems: ChecklistItemData[];
}

export function FloorShiftChecklist({ scheduleId, batchId, initialItems }: FloorShiftChecklistProps) {
  const [items, setItems] = useState(initialItems);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const done = items.filter((i) => i.status === "DONE").length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function toggle(item: ChecklistItemData) {
    if (updatingId) return; // Prevent double-clicks

    const newStatus = item.status === "DONE" ? "PENDING" : "DONE";
    setUpdatingId(item.id);

    // Optimistically update UI immediately
    if (newStatus === "PENDING") {
      setItems((prev) =>
        prev.map((i) => i.order >= item.order ? { ...i, status: "PENDING" } : i)
      );
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "DONE" } : i))
      );
    }

    try {
      const res = await fetch(
        `/api/schedules/${scheduleId}/batches/${batchId}/checklist`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: item.id, status: newStatus }),
        }
      );

      // If API failed, revert the optimistic update
      if (!res.ok) {
        if (newStatus === "DONE") {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: "PENDING" } : i))
          );
        } else {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: "DONE" } : i))
          );
        }
      }
    } catch {
      // Network error — revert
      if (newStatus === "DONE") {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "PENDING" } : i))
        );
      } else {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "DONE" } : i))
        );
      }
    } finally {
      setUpdatingId(null);
    }
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
        const isLoading = updatingId === item.id;

        // Item is locked if any previous item is not DONE or SKIPPED
        const isStepLocked = index > 0 && items.slice(0, index).some(
          (prev) => prev.status !== "DONE" && prev.status !== "SKIPPED"
        );

        return (
          <li key={item.id}>
            <button
              onClick={() => !isStepLocked && !updatingId && toggle(item)}
              disabled={isLoading || !!updatingId || isStepLocked}
              className={cn(
                "w-full flex items-center gap-3 px-5 py-3.5 text-left tap-target",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isDone && "opacity-60",
                isStepLocked
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-muted/50"
              )}
              aria-pressed={isDone}
              aria-disabled={isStepLocked}
              aria-label={isStepLocked ? `Locked: ${item.description}` : `${isDone ? "Unmark" : "Complete"}: ${item.description}`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
              ) : isDone ? (
                <CheckSquare className="w-5 h-5 shrink-0 text-primary" aria-hidden="true" />
              ) : isStepLocked ? (
                <Square className="w-5 h-5 shrink-0 text-muted-foreground/40" aria-hidden="true" />
              ) : (
                <Square className="w-5 h-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className={cn("text-sm", isDone && "line-through", isStepLocked && "text-muted-foreground")}>
                {item.description}
              </span>
              {/* Ingredient deduction tags */}
              {!isStepLocked && (item.deductions?.length || item.ingredientId) && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {item.deductions && item.deductions.length > 0 ? (
                    item.deductions.map((d, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        📦 {d.ingredient.name} −{formatGrams(d.deductionGrams)}
                      </span>
                    ))
                  ) : item.ingredient && item.deductionGrams ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      📦 {item.ingredient.name} −{formatGrams(item.deductionGrams)}
                    </span>
                  ) : null}
                </div>
              )}
              {isStepLocked && (
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
