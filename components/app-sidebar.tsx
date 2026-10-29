"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
import {
  type NavItem,
  overviewItems,
  analyticsItem,
  catalogItems,
  salesItems,
  orderApprovalsItem,
  adminItems,
  findNavTrail,
} from "@/components/nav-config";
import { accessRequestsKey, type AccessRequest } from "@/components/access-requests-panel";

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
    <SidebarGroup className={cn("px-0 py-1.5", className)}>
      {label && (
        <SidebarGroupLabel className="h-7 px-2.5 group-data-[collapsible=icon]:hidden">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:gap-2">
          {items.map((item) => {
            const active = isActive(item.href);
            const title = t(item.titleKey);
            return (
              <SidebarMenuItem key={item.href} className="relative">
                {active && (
                  <span className="absolute -left-2 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary/80 group-data-[collapsible=icon]:hidden" />
                )}
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={title}
                  className={cn(
                    "h-9 px-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring/50 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full",
                    active
                      ? "bg-primary/[0.07] text-primary font-semibold hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/[0.07] data-[active=true]:text-primary"
                      : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted",
                  )}
                >
                  <Link href={item.href} className="flex items-center w-full">
                    <div className="flex w-full items-center gap-2.5">
                      <item.icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                        strokeWidth={2}
                      />
                      <span className="min-w-0 truncate leading-tight group-data-[collapsible=icon]:hidden">
                        {title}
                      </span>
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
  const isActive = (href: string) => activeHref === href;

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r border-sidebar-border"
    >
      <SidebarHeader className="flex flex-col border-b-0 px-4 pt-4 pb-2 group-data-[collapsible=icon]:p-3 group-data-[collapsible=icon]:pt-6 group-data-[collapsible=icon]:items-center">
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

      <SidebarContent className="gap-0 px-4 group-data-[collapsible=icon]:px-0">
        <NavGroup
          items={
            isAdmin
              ? [
                  ...overviewItems,
                  analyticsItem,
                ]
              : overviewItems
          }
          isActive={isActive}
          t={tItems}
        />

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
                  { ...orderApprovalsItem, badge: pendingOrderCount },
                ]
              : salesItems
          }
          isActive={isActive}
          t={tItems}
        />

        {isLoading ? (
          <SidebarGroup className="animate-pulse px-0 py-1.5 border-t border-border/60 mt-1.5 pt-3">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="flex h-9 items-center gap-2.5 px-2.5">
                    <span className="size-4 rounded bg-muted shrink-0" />
                    <span className="h-3 w-20 rounded bg-muted block group-data-[collapsible=icon]:hidden" />
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : isAdmin ? (
          <NavGroup
            label={tGroups("administration")}
            items={adminItems.map((item) =>
              item.href === "/admin/users"
                ? { ...item, badge: pendingAccessRequests?.length ?? 0 }
                : item,
            )}
            isActive={isActive}
            t={tItems}
            className="animate-in fade-in duration-300 border-t border-border/60 mt-1.5 pt-3"
          />
        ) : null}
      </SidebarContent>

      <SidebarFooter className="mx-4 border-t border-border/60 px-0 py-3 group-data-[collapsible=icon]:mx-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
