"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser, useUserLoading } from "@/components/user-provider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { User, LogOut, ChevronsUpDown } from "lucide-react";

/** Mirrors the trigger's layout exactly, so nothing shifts once the user loads. */
function UserMenuSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div
          aria-hidden="true"
          className="flex min-h-11 items-center gap-2.5 px-2.5 py-1.5 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-36 max-w-full" />
          </div>
          <Skeleton className="ml-auto size-4 shrink-0 rounded group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** Lets a long email wrap at the "@" instead of mid-word. */
function EmailWithBreak({ email }: { email?: string | null }) {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at === -1) return <>{email}</>;
  return (
    <>
      {email.slice(0, at)}
      <wbr />
      {email.slice(at)}
    </>
  );
}

export function UserMenu() {
  const router = useRouter();
  const user = useUser();
  const isLoading = useUserLoading();

  const initials = (user?.full_name || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (isLoading && !user) return <UserMenuSkeleton />;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-auto min-h-11 py-1.5 px-2.5 gap-2.5 rounded-lg hover:bg-muted data-[state=open]:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary ring-1 ring-primary/15 flex items-center justify-center text-xs font-bold shrink-0">
                {initials}
              </div>
              <div
                className="flex flex-1 flex-col items-start min-w-0 text-left leading-tight group-data-[collapsible=icon]:hidden"
                title={[user?.full_name, user?.email].filter(Boolean).join("\n")}
              >
                <span className="text-sm font-semibold text-foreground truncate w-full">
                  {user?.full_name ?? "User"}
                </span>
                <span className="text-[11px] text-muted-foreground truncate w-full mt-0.5">
                  {user?.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground shrink-0 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            sideOffset={8}
            className="w-(--radix-dropdown-menu-trigger-width) rounded-xl p-1 mb-2 shadow-xs"
          >
            <div className="px-2 py-1.5">
              <p className="text-xs font-semibold break-words">
                {user?.full_name ?? "User"}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                <EmailWithBreak email={user?.email} />
              </p>
            </div>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              asChild
              className="rounded-md py-1.5 px-2 gap-2 cursor-pointer text-sm"
            >
              <Link href="/profile">
                <User className="size-3.5 text-muted-foreground" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={signOut}
              className="rounded-md py-1.5 px-2 gap-2 cursor-pointer text-sm"
            >
              <LogOut className="size-3.5" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
