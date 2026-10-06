"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
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
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useUser, useUserLoading } from "@/components/user-provider";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";

type NavItem = {
  /** Key into the Sidebar.items message namespace — see NavGroup's t() call. */
  titleKey: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
};

const overviewItems: NavItem[] = [
  { titleKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
];

const salesItems: NavItem[] = [
  { titleKey: "newSale", href: "/sales", icon: ShoppingCart },
  { titleKey: "salesLog", href: "/sales/log", icon: ClipboardList },
];

// Taxonomy first, then the stock built on top of it — ceramic_types
// reference brand/finish, and stock is tracked per ceramic (which
// references a ceramic_type), so this mirrors the actual dependency chain.
const catalogItems: NavItem[] = [
  { titleKey: "brands", href: "/brands", icon: Building2 },
  { titleKey: "finishes", href: "/finishes", icon: Palette },
  { titleKey: "ceramicTypes", href: "/ceramic-types", icon: Layers3 },
  { titleKey: "inventory", href: "/inventory", icon: PackageSearch },
];

function NavGroup({
  label,
  items,
  isActive,
  t,
  className,
}: {
  label?: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
  /** Translates a Sidebar.items key to its display label. */
  t: (key: string) => string;
  className?: string;
}) {
  return (
    <SidebarGroup className={cn("py-1", className)}>
      {label && (
        <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-1 group-data-[collapsible=icon]:gap-2 px-2 group-data-[collapsible=icon]:px-0">
          {items.map((item) => {
            const active = isActive(item.href);
            const title = t(item.titleKey);
            return (
              <SidebarMenuItem key={item.href} className="relative">
                {active && (
                  <span className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary group-data-[collapsible=icon]:-left-1" />
                )}
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={title}
                  className={cn(
                    "h-auto py-2.5 px-3 rounded-xl hover:bg-muted/50 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full",
                    active
                      ? "bg-primary/10 text-primary font-bold hover:bg-primary/15"
                      : "font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  <Link href={item.href} className="flex items-center w-full">
                    <div className="flex items-center gap-3">
                      <item.icon
                        className={cn(
                          "size-[18px] shrink-0",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                        strokeWidth={active ? 2.5 : 2}
                      />
                      <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                        <span className="leading-tight">{title}</span>
                      </div>
                      {!!item.badge && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] leading-none font-bold tabular-nums text-white group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:-top-1 group-data-[collapsible=icon]:-right-1 group-data-[collapsible=icon]:ml-0">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const tGroups = useTranslations("Sidebar.groups");
  const tItems = useTranslations("Sidebar.items");
  const pathname = usePathname();
  const user = useUser();
  const isLoading = useUserLoading();
  const isAdmin = user?.role === "admin";

  useOrdersRealtime(isAdmin);
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

  const localelessPath = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";

  const isActive = (href: string) => localelessPath === href;

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r border-sidebar-border"
    >
      <SidebarHeader className="flex flex-col border-b-0 p-6 pb-2 group-data-[collapsible=icon]:p-3 group-data-[collapsible=icon]:pt-6 group-data-[collapsible=icon]:items-center">
        <div className="flex w-full items-center justify-between group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-6">
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:hidden">
            <Image
              src="/logo-192.png"
              alt="Kiln"
              width={28}
              height={28}
              className="rounded-md shrink-0"
            />
            <p className="font-bold text-xl leading-tight tracking-tight">
              Kiln
            </p>
          </div>
          <SidebarTrigger className="hidden h-8 w-8 shrink-0 md:flex group-data-[collapsible=icon]:-mt-1" />
          <Image
            src="/logo-192.png"
            alt="Kiln"
            width={28}
            height={28}
            className="rounded-md hidden group-data-[collapsible=icon]:block"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-1 mt-4 group-data-[collapsible=icon]:px-0">
        <NavGroup items={overviewItems} isActive={isActive} t={tItems} />

        <NavGroup
          label={tGroups("catalog")}
          items={catalogItems}
          isActive={isActive}
          t={tItems}
        />

        <NavGroup
          label={tGroups("sales")}
          items={
            isAdmin
              ? [
                  ...salesItems,
                  {
                    titleKey: "orderApprovals",
                    href: "/orders",
                    icon: ClipboardCheck,
                    badge: pendingOrderCount,
                  },
                ]
              : salesItems
          }
          isActive={isActive}
          t={tItems}
        />

        {isLoading ? (
          <SidebarGroup className="animate-pulse py-2 border-t border-border/60 mt-2 pt-3">
            <SidebarGroupContent>
              <SidebarMenu className="px-2">
                <SidebarMenuItem>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <span className="h-[18px] w-[18px] rounded bg-muted shrink-0" />
                    <span className="h-3 w-20 rounded bg-muted block group-data-[collapsible=icon]:hidden" />
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : isAdmin ? (
          <NavGroup
            label={tGroups("administration")}
            items={[
              { titleKey: "users", href: "/admin/users", icon: ShieldCheck },
              {
                titleKey: "auditLogs",
                href: "/admin/audit-logs",
                icon: ScrollText,
              },
            ]}
            isActive={isActive}
            t={tItems}
            className="animate-in fade-in duration-300 border-t border-border/60 mt-2 pt-3"
          />
        ) : null}
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2 border-t-0 mb-2">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
