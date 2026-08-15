"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface ProcurementApproveButtonProps {
  recommendationId: string;
}

export function ProcurementApproveButton({ recommendationId }: ProcurementApproveButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [approved, setApproved] = useState(false);

  function handleApprove() {
    startTransition(async () => {
      const res = await fetch(`/api/procurement/${recommendationId}/approve`, {
        method: "POST",
      });

      if (res.ok) {
        setApproved(true);
        router.refresh();
      }
    });
  }

  if (approved) {
    return (
      <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
        <CheckCircle className="w-4 h-4" />
        Approved
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="primary"
      loading={isPending}
      onClick={handleApprove}
      className="shrink-0"
    >
      Approve
    </Button>
  );
}
