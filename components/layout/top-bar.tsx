"use client";

import { useState, useRef, useEffect } from "react";
import { Menu, Bell, LogOut, ExternalLink, Sparkles } from "lucide-react";
import { signOut } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { openDemoTour } from "@/components/ui/demo-tour";
import { ShiftClock } from "./shift-clock";
import type { SessionUser } from "@/types";

const IS_DEMO = process.env.NEXT_PUBLIC_APP_MODE === "demo";

interface TopBarProps {
  user: SessionUser;
  onMenuClick: () => void;
  openingTime?: string;
  closingTime?: string;
}

interface AlertData {
  id: string;
  title: string;
  message: string;
  severity: string;
  type: string;
  createdAt: string;
}

export function TopBar({ user, onMenuClick, openingTime = "05:00", closingTime = "20:00" }: TopBarProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: alerts } = useQuery({
    queryKey: ["alerts-unread"],
    queryFn: async () => {
      const res = await fetch("/api/alerts?unread=true");
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
    refetchInterval: 2_000,
  });

  const unreadAlerts = (alerts as AlertData[]) ?? [];
  const unreadCount = unreadAlerts.length;

  // Close panel when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    if (panelOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [panelOpen]);

  const severityColor = (s: string) =>
    s === "CRITICAL" ? "bg-red-500" :
    s === "WARNING"  ? "bg-amber-500" :
    "bg-blue-500";

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 md:px-6 border-b border-border bg-card/95 backdrop-blur-sm">
      {/* Left: hamburger (mobile only) */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors tap-target"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Live shift clock (desktop) */}
      <div className="hidden lg:block">
        <ShiftClock openingTime={openingTime} closingTime={closingTime} />
      </div>

      {/* Right: theme + alerts + user */}
      <div className="flex items-center gap-2">
        {/* Relaunch the feature tour (demo mode) */}
        {IS_DEMO && (
          <button
            onClick={() => openDemoTour()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors tap-target"
            aria-label="Take the feature tour"
            title="Take the feature tour"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tour</span>
          </button>
        )}

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Alert bell with dropdown */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors tap-target"
            aria-label={`${unreadCount} unread alerts`}
            aria-expanded={panelOpen}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-white"
                aria-hidden="true"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown panel */}
          {panelOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
              </div>

              {/* Alert list */}
              <div className="overflow-y-auto max-h-72">
                {unreadAlerts.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No new notifications
                  </div>
                ) : (
                  <ul className="divide-y divide-border" role="list">
                    {unreadAlerts.slice(0, 8).map((alert) => (
                      <li key={alert.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start gap-2.5">
                          <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", severityColor(alert.severity))} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer link */}
              <Link
                href="/dashboard/alerts"
                onClick={() => setPanelOpen(false)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-border text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                View all alerts
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* User avatar + sign out */}
        <div className="flex items-center gap-1">
          <UserAvatar user={user} size="sm" />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 rounded-lg hover:bg-muted transition-colors tap-target text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
