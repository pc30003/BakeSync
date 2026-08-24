"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PWAUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version available
            setShowUpdate(true);
          }
        });
      });
    });
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-card border border-border rounded-xl shadow-xl p-4 flex items-center gap-3 animate-fade-in">
      <RefreshCw className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">New version available</p>
        <p className="text-xs text-muted-foreground">Tap to update BakeSync</p>
      </div>
      <Button
        size="sm"
        variant="primary"
        onClick={() => window.location.reload()}
      >
        Update
      </Button>
    </div>
  );
}
