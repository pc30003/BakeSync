"use client";

import { useState, useEffect, useCallback } from "react";
import { X, AlertTriangle, Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Toast {
  id: string;
  title: string;
  message?: string;
  severity: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";
  duration?: number; // ms, default 5000
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const severityConfig = {
  INFO:     { icon: Info,          bg: "bg-blue-50 border-blue-200",   text: "text-blue-800",   iconColor: "text-blue-500" },
  WARNING:  { icon: AlertTriangle, bg: "bg-amber-50 border-amber-200", text: "text-amber-800",  iconColor: "text-amber-500" },
  CRITICAL: { icon: AlertCircle,   bg: "bg-red-50 border-red-200",     text: "text-red-800",    iconColor: "text-red-500" },
  SUCCESS:  { icon: CheckCircle2,  bg: "bg-green-50 border-green-200", text: "text-green-800",  iconColor: "text-green-500" },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const config = severityConfig[toast.severity];
  const Icon = config.icon;

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setVisible(true));

    // Auto dismiss
    const duration = toast.duration ?? 5000;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full transition-all duration-300",
        config.bg,
        visible && !exiting ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      )}
      role="alert"
    >
      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", config.iconColor)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", config.text)}>{toast.title}</p>
        {toast.message && (
          <p className={cn("text-xs mt-0.5 opacity-80", config.text)}>{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="p-1 rounded hover:bg-black/5 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5 opacity-50" />
      </button>
    </div>
  );
}

// ── Toast Container (renders all active toasts) ──────────────────────────────

let addToastGlobal: ((toast: Omit<Toast, "id">) => void) | null = null;

export function useToast() {
  return {
    toast: (t: Omit<Toast, "id">) => {
      if (addToastGlobal) addToastGlobal(t);
    },
  };
}

// Allow external access for non-hook contexts
export function showToast(t: Omit<Toast, "id">) {
  if (addToastGlobal) addToastGlobal(t);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    addToastGlobal = addToast;
    return () => { addToastGlobal = null; };
  }, [addToast]);

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={removeToast} />
        </div>
      ))}
    </div>
  );
}
