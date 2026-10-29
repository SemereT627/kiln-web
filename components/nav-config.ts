import {
  LayoutDashboard,
  ChartColumn,
  PackageSearch,
  ShoppingCart,
  ClipboardList,
  Building2,
  Palette,
  Layers3,
  ShieldCheck,
  ScrollText,
  ClipboardCheck,
} from "lucide-react";

/**
 * Single source of truth for the dashboard's navigation — the sidebar
 * renders these groups and the top-bar breadcrumb resolves the current
 * path against them, so the two can't drift apart.
 */
export type NavItem = {
  /** Key into the Sidebar.items message namespace. */
  titleKey: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
};

/** Key into the Sidebar.groups message namespace. */
export type NavGroupKey = "overview" | "catalog" | "sales" | "administration";

export const overviewItems: NavItem[] = [
  { titleKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
];

export const analyticsItem: NavItem = {
  titleKey: "analytics",
  href: "/analytics",
  icon: ChartColumn,
};

// Taxonomy first, then the stock built on top of it — ceramic_types
// reference brand/finish, and stock is tracked per ceramic (which
// references a ceramic_type), so this mirrors the actual dependency chain.
export const catalogItems: NavItem[] = [
  { titleKey: "brands", href: "/brands", icon: Building2 },
  { titleKey: "finishes", href: "/finishes", icon: Palette },
  { titleKey: "ceramicTypes", href: "/ceramic-types", icon: Layers3 },
  { titleKey: "inventory", href: "/inventory", icon: PackageSearch },
];

export const salesItems: NavItem[] = [
  { titleKey: "newSale", href: "/sales", icon: ShoppingCart },
  { titleKey: "salesLog", href: "/sales/log", icon: ClipboardList },
];

export const orderApprovalsItem: NavItem = {
  titleKey: "orderApprovals",
  href: "/orders",
  icon: ClipboardCheck,
};

export const adminItems: NavItem[] = [
  { titleKey: "users", href: "/admin/users", icon: ShieldCheck },
  { titleKey: "auditLogs", href: "/admin/audit-logs", icon: ScrollText },
];

const NAV_GROUPS: { groupKey: NavGroupKey; items: NavItem[] }[] = [
  { groupKey: "overview", items: [...overviewItems, analyticsItem] },
  { groupKey: "catalog", items: catalogItems },
  { groupKey: "sales", items: [...salesItems, orderApprovalsItem] },
  { groupKey: "administration", items: adminItems },
];

/** Group + item for a locale-less pathname, or null if it isn't a nav page. */
export function findNavTrail(path: string) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => i.href === path);
    if (item) return { groupKey: group.groupKey, item };
  }
  // Detail pages (e.g. /inventory/[id]) belong to their parent nav item.
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => path.startsWith(`${i.href}/`));
    if (item) return { groupKey: group.groupKey, item };
  }
  return null;
}
