"use client";

/**
 * Drawer — a slide-over panel from the right side of the screen.
 * Used for forms that need enough vertical space to scroll.
 * Traps focus and supports Escape to close.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Defaults to "lg" (512px). Use "xl" for wide forms. */
  width?: "md" | "lg" | "xl";
  children: React.ReactNode;
}

const widthClass = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Drawer({ open, onClose, title, subtitle, width = "lg", children }: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={title}>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "relative ml-auto flex flex-col w-full bg-card shadow-2xl",
          "animate-[slideInRight_0.25s_ease-out]",
          widthClass[width]
        )}
        style={{
          // Inline animation since Tailwind arbitrary keyframes don't work without config
          animation: "slideInRight 0.25s ease-out",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors tap-target ml-4 shrink-0"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
