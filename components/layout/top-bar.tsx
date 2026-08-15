"use client";

import { Menu, Bell, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { SessionUser } from "@/types";

interface TopBarProps {
  user: SessionUser;
  onMenuClick: () => void;
}

export function TopBar({ user, onMenuClick }: TopBarProps) {
  const { data: alerts } = useQuery({
    queryKey: ["alerts-unread"],
    queryFn: async () => {
      const res = await fetch("/api/alerts?unread=true");
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
    refetchInterval: 30_000,
  });

  const unreadCount = (alerts as any[])?.length ?? 0;

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

      {/* Spacer on desktop */}
      <div className="hidden lg:block" />

      {/* Right: alerts + user */}
      <div className="flex items-center gap-2">
        {/* Alert bell */}
        <Link
          href="/dashboard/alerts"
          className="relative p-2 rounded-lg hover:bg-muted transition-colors tap-target"
          aria-label={`${unreadCount} unread alerts`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive"
              aria-hidden="true"
            />
          )}
        </Link>

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
