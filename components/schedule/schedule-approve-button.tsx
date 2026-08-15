"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScheduleApproveButtonProps {
  scheduleId:  string;
  isApproved:  boolean;
  approvedBy?: string | null;
}

export function ScheduleApproveButton({
  scheduleId,
  isApproved,
  approvedBy,
}: ScheduleApproveButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localApproved, setLocalApproved] = useState(isApproved);
  const [localApprovedBy, setLocalApprovedBy] = useState(approvedBy);

  async function toggle() {
    startTransition(async () => {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ approved: !localApproved }),
      });
      if (res.ok) {
        const json = await res.json();
        setLocalApproved(!localApproved);
        setLocalApprovedBy(json.data?.approvedBy?.name ?? null);
        router.refresh();
      }
    });
  }

  if (localApproved) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Approved{localApprovedBy ? ` by ${localApprovedBy}` : ""}
        </div>
        <Button
          variant="outline"
          size="sm"
          loading={isPending}
          onClick={toggle}
          leftIcon={<XCircle className="w-3.5 h-3.5" />}
        >
          Revoke
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      loading={isPending}
      onClick={toggle}
      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
      className="bg-green-600 hover:bg-green-700 focus-visible:ring-green-500"
    >
      Approve schedule
    </Button>
  );
}
