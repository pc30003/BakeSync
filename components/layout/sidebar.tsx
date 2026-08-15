"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, ClipboardCheck, BookOpen,
  ShoppingBag, Package, Trash2, ShoppingCart, Truck,
  BarChart3, X, ChevronRight, Bot, Settings, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavForRole, getRoleLabel } from "./nav-config";
import { UserAvatar } from "@/components/ui/user-avatar";
import { BakeSyncLogo } from "@/components/ui/bakesync-logo";
import type { SessionUser } from "@/types";
import { useQuery } from "@tanstack/react-query";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, CalendarDays, ClipboardCheck, BookOpen,
  ShoppingBag, Package, Trash2, ShoppingCart, Truck, BarChart3, Bot, Settings, CreditCard,
};

interface SidebarProps {
  user: SessionUser;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ user, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const sections = getNavForRole(user.role);

  const { data: analytics } = useQuery({
    queryKey: ["analytics-snapshot"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      if (!res.ok) return null;
      const json = await res.json();
      return json.data?.snapshot ?? null;
    },
    refetchInterval: 60_000,
  });

  const badgeCounts: Record<string, number> = {
    activeOrders:        analytics?.activeOrders        ?? 0,
    criticalStock:       analytics?.criticalStock        ?? 0,
    pendingProcurements: analytics?.pendingProcurements  ?? 0,
    unreadAlerts:        analytics?.unreadAlerts         ?? 0,
  };

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col z-30 border-r border-border bg-card">
        <SidebarContent
          user={user}
          sections={sections}
          pathname={pathname}
          badgeCounts={badgeCounts}
          onClose={onClose}
          showClose={false}
        />
      </aside>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-72 flex flex-col z-30 border-r border-border bg-card",
          "transform transition-transform duration-300 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Navigation menu"
      >
        <SidebarContent
          user={user}
          sections={sections}
          pathname={pathname}
          badgeCounts={badgeCounts}
          onClose={onClose}
          showClose
        />
      </aside>
    </>
  );
}

interface SidebarContentProps {
  user: SessionUser;
  sections: ReturnType<typeof getNavForRole>;
  pathname: string;
  badgeCounts: Record<string, number>;
  onClose: () => void;
  showClose: boolean;
}

function SidebarContent({
  user, sections, pathname, badgeCounts, onClose, showClose,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">

      {/* ── Logo header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#FFFBEB]">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5 min-w-0">
          <BakeSyncLogo variant="icon" size="sm" className="rounded-lg shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-[#4A2010] text-sm leading-tight">BakeSync</p>
            <p className="text-[10px] text-[#D97706] font-medium leading-tight truncate">
              {getRoleLabel(user.role)}
            </p>
          </div>
        </Link>
        {showClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors tap-target ml-2 shrink-0"
            aria-label="Close menu"
          >
            <X className="w-4 h-4 text-[#4A2010]" />
          </button>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto py-3 px-2 space-y-4"
        aria-label="Main navigation"
      >
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-0.5" role="list">
              {section.items.map((item) => {
                const Icon     = ICON_MAP[item.icon] ?? ChevronRight;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const count    = item.badge ? (badgeCounts[item.badge] ?? 0) : 0;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                        "transition-colors tap-target",
                        isActive
                          ? "bg-[#D97706] text-white shadow-sm"
                          : "text-foreground hover:bg-amber-50 hover:text-[#4A2010]"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0",
                            isActive
                              ? "bg-white/30 text-white"
                              : "bg-[#D97706] text-white"
                          )}
                          aria-label={`${count} items`}
                        >
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── User footer ────────────────────────────────────────────────── */}
      <div className="border-t border-border px-4 py-3 bg-[#FFFBEB]">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar user={user} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#4A2010] truncate">
              {user.name ?? "Team Member"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </div>

    </div>
  );
}
