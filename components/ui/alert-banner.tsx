"use client";

import { AlertTriangle, Info, XCircle, X } from "lucide-react";
import { cn, getSeverityColor } from "@/lib/utils";
import type { AgentAlert } from "@/types";

interface AlertBannerProps {
  alert: AgentAlert;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

const ICONS = {
  CRITICAL: XCircle,
  WARNING:  AlertTriangle,
  INFO:     Info,
};

export function AlertBanner({ alert, onDismiss, compact }: AlertBannerProps) {
  const Icon = ICONS[alert.severity as keyof typeof ICONS] ?? Info;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-lg border text-sm",
        getSeverityColor(alert.severity)
      )}
      role="alert"
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">{alert.title}</p>
        {!compact && (
          <p className="mt-0.5 text-xs opacity-80 leading-snug">{alert.message}</p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={() => onDismiss(alert.id)}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity tap-target"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
