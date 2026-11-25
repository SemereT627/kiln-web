"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSelector } from "@/components/locale-selector";
import { NotificationsBell } from "@/components/notifications-bell";
import { UserMenu } from "@/components/user-menu";
import { useNavGroups } from "@/hooks/use-nav-groups";

const LINK =
  "flex h-9 items-center gap-1 rounded-full px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50";
const IDLE = "text-muted-foreground hover:text-foreground";
const ACTIVE = "font-medium text-foreground";

function Badge({ count }: { count: number }) {
  return (
    <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none tabular-nums text-white">
      {count}
    </span>
  );
}

/**
 * Top bar: brand and nav links in a white bar on the left (links in a group
 * open a menu), quick actions and the account pill on the right. Below md
 * the links move into the slide-in sidebar behind the menu button.
 */
export function TopNav() {
  const { groups, isActive, isAdmin, title } = useNavGroups();

  return (
    <header className="z-10 flex shrink-0 items-center gap-3 px-4 pt-4 md:px-8">
      <SidebarTrigger className="size-11 rounded-full bg-card md:hidden" />

      <nav
        aria-label="Main"
        className="flex h-14 min-w-0 flex-1 items-center gap-2 rounded-[20px] bg-card px-5 md:flex-none"
      >
        <Link href="/dashboard" className="mr-4 flex shrink-0 items-center gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <Image src="/logo-192.png" alt="" width={24} height={24} className="rounded-md" />
          <span className="text-lg font-bold tracking-tight">Kiln</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex lg:gap-3">
          {groups.map((group) => {
            // Ungrouped links (Dashboard, Analytics) sit directly in the bar.
            if (!group.label) {
              return group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(LINK, isActive(item.href) ? ACTIVE : IDLE)}
                >
                  {title(item)}
                </Link>
              ));
            }
            const active = group.items.some((i) => isActive(i.href));
            const badge = group.items.reduce((a, i) => a + (i.badge ?? 0), 0);
            return (
              <DropdownMenu key={group.key}>
                <DropdownMenuTrigger className={cn(LINK, active ? ACTIVE : IDLE, "data-[state=open]:text-foreground")}>
                  {group.label}
                  {badge > 0 && <Badge count={badge} />}
                  <ChevronDown className="size-3.5 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={10} className="min-w-52 rounded-xl p-1">
                  {group.items.map((item) => (
                    <DropdownMenuItem key={item.href} asChild className="gap-2.5 rounded-lg py-2">
                      <Link
                        href={item.href}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        className={cn(isActive(item.href) && "font-medium text-primary")}
                      >
                        <item.icon className={cn("size-4", isActive(item.href) && "text-primary")} />
                        {title(item)}
                        {!!item.badge && (
                          <span className="ml-auto">
                            <Badge count={item.badge} />
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  {group.key === "administration" && isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="gap-2.5 rounded-lg py-2">
                        <a href="https://vatflow.semere.app" target="_blank" rel="noopener noreferrer">
                          <span className="relative size-4 shrink-0">
                            <Image src="/vatflow-mark.png" alt="" fill sizes="16px" className="object-contain" />
                          </span>
                          VatFlow
                          <ArrowUpRight className="ml-auto size-3.5 text-muted-foreground" />
                        </a>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <div className="flex h-14 items-center gap-1 rounded-full bg-card px-2">
          <ThemeToggle className="size-10 rounded-full" />
          <span aria-hidden="true" className="h-5 w-px bg-border" />
          <LocaleSelector className="size-10 rounded-full" />
          <span aria-hidden="true" className="h-5 w-px bg-border" />
          <NotificationsBell className="size-10 rounded-full" />
        </div>
        <div className="hidden md:block">
          <UserMenu variant="pill" />
        </div>
      </div>
    </header>
  );
}
