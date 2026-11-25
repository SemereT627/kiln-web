"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useUser } from "@/components/user-provider";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { useNavGroups } from "@/hooks/use-nav-groups";

const ITEM_CLASS =
  "h-9 px-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * Phone-only slide-in menu (opened from the top bar's menu button). On
 * larger screens the top nav carries the same links, so this renders
 * nothing — but it stays mounted for the session redirect and the orders
 * realtime subscription.
 */
export function AppSidebar() {
  const user = useUser();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const { groups, isActive, isAdmin, isLoading, title } = useNavGroups();

  // Session gone (expired or signed out elsewhere): go to sign-in rather than
  // leaving an empty dashboard that says "User".
  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  useOrdersRealtime(isAdmin);

  if (!isMobile) return null;

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-192.png" alt="Kiln" width={28} height={28} className="rounded-md shrink-0" />
          <p className="font-bold text-xl leading-tight tracking-tight">Kiln</p>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-4">
        {groups.map((group) => (
          <SidebarGroup
            key={group.key}
            className={cn(
              "px-0 py-1.5",
              group.key === "administration" && "border-t border-border/60 mt-1.5 pt-3",
            )}
          >
            {group.label && (
              <SidebarGroupLabel className="h-7 px-2.5">{group.label}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.href} className="relative">
                      {active && (
                        <span className="absolute -left-2 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary/80" />
                      )}
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={cn(
                          ITEM_CLASS,
                          active
                            ? "bg-primary/[0.07] text-primary font-semibold hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/[0.07] data-[active=true]:text-primary"
                            : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted",
                        )}
                      >
                        <Link
                          href={item.href}
                          onClick={() => setOpenMobile(false)}
                          className="flex w-full items-center gap-2.5"
                        >
                          <item.icon
                            className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
                            strokeWidth={2}
                          />
                          <span className="min-w-0 truncate leading-tight">{title(item)}</span>
                          {!!item.badge && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] leading-none font-bold tabular-nums text-white">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Sibling app — pinned to the bottom of the nav, above the account footer */}
        {isAdmin && (
          <SidebarGroup className="mt-auto px-0 py-1.5">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={cn(ITEM_CLASS, "font-medium text-muted-foreground hover:bg-muted hover:text-foreground")}
                  >
                    <a
                      href="https://vatflow.semere.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="VatFlow (opens in a new tab)"
                      className="flex w-full items-center gap-2.5"
                    >
                      {/* VatFlow's own mark, copied from vatflow-web/public/brand */}
                      <span className="relative size-4 shrink-0">
                        <Image src="/vatflow-mark.png" alt="" fill sizes="16px" className="object-contain" />
                      </span>
                      <span className="min-w-0 truncate leading-tight">VatFlow</span>
                      <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-muted-foreground/70" />
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="mx-4 border-t border-border/60 px-0 py-3">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
