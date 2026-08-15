"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Escape to cancel
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
