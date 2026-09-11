"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-provider";
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

export function UserMenu() {
  const router = useRouter();
  const user = useUser();

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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-auto py-2.5 px-3 rounded-xl hover:bg-muted/50 data-[state=open]:bg-muted/50 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary ring-1 ring-primary/15 flex items-center justify-center text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="flex flex-col items-start min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold text-foreground truncate w-full">
                  {user?.full_name ?? "User"}
                </span>
                <span className="text-xs text-muted-foreground truncate w-full">
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
              <p className="text-xs font-semibold truncate">
                {user?.full_name ?? "User"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {user?.email}
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
