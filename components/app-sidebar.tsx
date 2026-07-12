"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
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
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useUser, useUserLoading } from "@/components/user-provider";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
};

const mainItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Inventory", href: "/inventory", icon: PackageSearch },
  { title: "Sales", href: "/sales", icon: ShoppingCart },
  { title: "Sales Log", href: "/sales/log", icon: ClipboardList },
  { title: "Brands", href: "/brands", icon: Building2 },
  { title: "Finishes", href: "/finishes", icon: Palette },
  { title: "Ceramic Types", href: "/ceramic-types", icon: Layers3 },
];

function NavGroup({
  items,
  isActive,
  className,
}: {
  items: NavItem[];
  isActive: (href: string) => boolean;
  className?: string;
}) {
  return (
    <SidebarGroup className={cn("py-1", className)}>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1 group-data-[collapsible=icon]:gap-2 px-2 group-data-[collapsible=icon]:px-0">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <SidebarMenuItem key={item.href} className="relative">
                {active && (
                  <span className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary group-data-[collapsible=icon]:-left-1" />
                )}
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.title}
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
                        <span className="leading-tight">{item.title}</span>
                      </div>
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useUser();
  const isLoading = useUserLoading();

  const localelessPath = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";

  const isActive = (href: string) => {
    if (href.includes("?")) {
      const [path, query] = href.split("?");
      const tab = query.split("=")[1];
      return localelessPath === path && searchParams.get("tab") === tab;
    }
    return localelessPath === href;
  };

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
              alt="ACSM"
              width={28}
              height={28}
              className="rounded-md shrink-0"
            />
            <p className="font-bold text-xl leading-tight tracking-tight">
              ACSM
            </p>
          </div>
          <SidebarTrigger className="hidden h-8 w-8 shrink-0 md:flex group-data-[collapsible=icon]:-mt-1" />
          <Image
            src="/logo-192.png"
            alt="ACSM"
            width={28}
            height={28}
            className="rounded-md hidden group-data-[collapsible=icon]:block"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-1 mt-4 group-data-[collapsible=icon]:px-0">
        <NavGroup items={mainItems} isActive={isActive} />

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
        ) : user?.role === "admin" ? (
          <NavGroup
            items={[
              { title: "Users", href: "/admin/users", icon: ShieldCheck },
              { title: "Audit Log", href: "/admin/audit-logs", icon: ScrollText },
            ]}
            isActive={isActive}
            className="animate-in fade-in duration-300 border-t border-border/60 mt-2 pt-3"
          />
        ) : null}
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2 border-t-0 mb-2">
        <UserMenu isSidebar />
      </SidebarFooter>
    </Sidebar>
  );
}
