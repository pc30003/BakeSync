import type { UserRole } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: string;       // lucide icon name
  badge?: string;     // key into badgeCounts — resolved at runtime in sidebar
  roles: UserRole[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href:  "/dashboard",
        icon:  "LayoutDashboard",
        roles: ["HEAD_BAKER", "FLOOR_STAFF", "PURCHASING_MANAGER"],
      },
    ],
  },
  {
    title: "Production",
    items: [
      {
        label: "Today's Schedule",
        href:  "/dashboard/schedule",
        icon:  "CalendarDays",
        roles: ["HEAD_BAKER", "FLOOR_STAFF"],
      },
      {
        label: "My Shift",
        href:  "/dashboard/floor-staff",
        icon:  "ClipboardCheck",
        roles: ["FLOOR_STAFF"],
      },
      {
        label: "Recipes",
        href:  "/dashboard/recipes",
        icon:  "BookOpen",
        roles: ["HEAD_BAKER"],
      },
    ],
  },
  {
    title: "Orders",
    items: [
      {
        label: "All Orders",
        href:  "/dashboard/orders",
        icon:  "ShoppingBag",
        badge: "activeOrders",
        roles: ["HEAD_BAKER", "PURCHASING_MANAGER"],
      },
    ],
  },
  {
    title: "Inventory",
    items: [
      {
        label: "Stock Levels",
        href:  "/dashboard/inventory",
        icon:  "Package",
        badge: "criticalStock",
        roles: ["HEAD_BAKER", "PURCHASING_MANAGER"],
      },
      {
        label: "Log Wastage",
        href:  "/dashboard/wastage",
        icon:  "Trash2",
        roles: ["FLOOR_STAFF", "HEAD_BAKER"],
      },
    ],
  },
  {
    title: "Procurement",
    items: [
      {
        label: "Recommendations",
        href:  "/dashboard/procurement",
        icon:  "ShoppingCart",
        badge: "pendingProcurements",
        roles: ["PURCHASING_MANAGER", "HEAD_BAKER"],
      },
      {
        label: "Suppliers",
        href:  "/dashboard/suppliers",
        icon:  "Truck",
        roles: ["PURCHASING_MANAGER", "HEAD_BAKER"],
      },
    ],
  },
  {
    title: "Intelligence",
    items: [
      {
        label: "Analytics",
        href:  "/dashboard/analytics",
        icon:  "BarChart3",
        roles: ["HEAD_BAKER"],
      },
      {
        label: "Alerts",
        href:  "/dashboard/alerts",
        icon:  "Bot",
        badge: "unreadAlerts",
        roles: ["HEAD_BAKER", "PURCHASING_MANAGER"],
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        label: "Bakery Settings",
        href:  "/dashboard/settings",
        icon:  "Settings",
        roles: ["HEAD_BAKER"],
      },
    ],
  },
];

export function getNavForRole(role: UserRole): NavSection[] {
  return NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}

export function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case "HEAD_BAKER":         return "/dashboard/head-baker";
    case "FLOOR_STAFF":        return "/dashboard/floor-staff";
    case "PURCHASING_MANAGER": return "/dashboard/purchasing";
  }
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "HEAD_BAKER":         return "Head Baker";
    case "FLOOR_STAFF":        return "Kitchen Staff";
    case "PURCHASING_MANAGER": return "Purchasing Manager";
  }
}
