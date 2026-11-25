"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useUser, useUserLoading } from "@/components/user-provider";
import {
  type NavItem,
  type NavGroupKey,
  overviewItems,
  analyticsItem,
  catalogItems,
  salesItems,
  orderApprovalsItem,
  paymentsItem,
  adminItems,
  findNavTrail,
} from "@/components/nav-config";
import { accessRequestsKey, type AccessRequest } from "@/components/access-requests-panel";

export interface NavGroupData {
  key: NavGroupKey;
  /** Undefined for the ungrouped overview links. */
  label?: string;
  items: NavItem[];
}

/**
 * The nav groups the current user may see, with live badge counts, plus the
 * active item. Shared by the top nav (desktop) and the slide-in sidebar
 * (phone); their queries share cache entries, so each count is fetched once.
 */
export function useNavGroups() {
  const tGroups = useTranslations("Sidebar.groups");
  const tItems = useTranslations("Sidebar.items");
  const pathname = usePathname();
  const user = useUser();
  const isLoading = useUserLoading();
  const isAdmin = user?.role === "admin";

  const { data: pendingOrders } = useQuery({
    queryKey: ["orders", "pending", { page: 1 }],
    queryFn: async () => {
      const res = await fetch("/api/orders?status=pending&limit=1");
      if (!res.ok) throw new Error("Failed to fetch pending orders");
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  const { data: pendingReturnRequests } = useQuery({
    queryKey: ["return-requests", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/return-requests?status=pending&limit=1");
      if (!res.ok) throw new Error("Failed to fetch pending return requests");
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  // Combined "things awaiting your approval" count — return requests are
  // folded into the Orders page itself (not a separate queue), so they
  // share this one badge rather than getting their own.
  const pendingOrderCount =
    (pendingOrders?.total ?? 0) + (pendingReturnRequests?.total ?? 0);

  // Shares its cache entry with the Users page's access-requests panel.
  const { data: pendingAccessRequests } = useQuery<AccessRequest[]>({
    queryKey: accessRequestsKey("pending"),
    queryFn: async () => {
      const res = await fetch("/api/admin/access-requests?status=pending&limit=50");
      if (!res.ok) throw new Error("Failed to fetch access requests");
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  const localelessPath = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  // Resolved via the nav trail so detail pages (/inventory/[id]) keep their
  // parent item highlighted, without /sales also lighting up on /sales/log.
  const activeHref = findNavTrail(localelessPath)?.item.href;

  const groups: NavGroupData[] = [
    { key: "overview", items: isAdmin ? [...overviewItems, analyticsItem] : overviewItems },
    { key: "catalog", label: tGroups("catalog"), items: catalogItems },
    {
      key: "sales",
      label: tGroups("sales"),
      items: isAdmin
        ? [...salesItems, { ...orderApprovalsItem, badge: pendingOrderCount }, paymentsItem]
        : salesItems,
    },
  ];
  if (isAdmin) {
    groups.push({
      key: "administration",
      label: tGroups("administration"),
      items: adminItems.map((item) =>
        item.href === "/admin/users"
          ? { ...item, badge: pendingAccessRequests?.length ?? 0 }
          : item,
      ),
    });
  }

  return {
    groups,
    isActive: (href: string) => activeHref === href,
    isAdmin,
    isLoading,
    title: (item: NavItem) => tItems(item.titleKey),
  };
}
