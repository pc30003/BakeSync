"use client";

/**
 * ScheduleCloseButton
 *
 * Shown to the Head Baker only when a schedule is approved AND every checklist
 * step is complete. Clicking it finishes the production run: the schedule is
 * archived to History and its consumed stock stays deducted (this is the
 * deliberate opposite of Revoke). The parent only renders this when
 * `allStepsDone` is true, so the button never appears mid-production.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScheduleCloseButtonProps {
  scheduleId:   string;
  allStepsDone: boolean;
}

export function ScheduleCloseButton({ scheduleId, allStepsDone }: ScheduleCloseButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function close() {
    if (!allStepsDone) return; // extra safety — button is disabled anyway
    setErrorMsg(null);
    startTransition(async () => {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ close: true }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const json = await res.json().catch(() => null);
        setErrorMsg(json?.error ?? "Couldn't close the schedule. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        size="sm"
        loading={isPending}
        disabled={!allStepsDone || isPending}
        onClick={close}
        leftIcon={isPending ? undefined : <PackageCheck className="w-3.5 h-3.5" />}
        title={allStepsDone ? "Finish this run and move it to History" : "Complete all checklist steps first"}
      >
        {isPending ? "Closing…" : "Complete & archive run"}
      </Button>
      {!allStepsDone && !isPending && (
        <p className="text-[11px] text-muted-foreground max-w-[220px] text-right">
          Complete all checklist steps to enable
        </p>
      )}
      {errorMsg && <p className="text-[11px] text-destructive max-w-[220px] text-right">{errorMsg}</p>}
    </div>
  );
}
