import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSelector } from "@/components/locale-selector";
import { NotificationsBell } from "@/components/notifications-bell";
import {
  TopbarGreeting,
  TopbarClock,
} from "@/components/dashboard/topbar-greeting";
import { TopbarBreadcrumb } from "@/components/topbar-breadcrumb";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-svh w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background/80 backdrop-blur-md z-10">
            <SidebarTrigger className="-ml-1 size-11 md:hidden" />
            <div className="flex min-w-0 flex-1 items-center">
              <TopbarGreeting />
              <TopbarBreadcrumb />
            </div>
            <TopbarClock />
            <ThemeToggle className="size-11" />
            <LocaleSelector className="size-11" />
            <NotificationsBell className="size-11" />
          </header>
          <main className="flex-1 relative">
            <div className="absolute inset-0 p-5 overflow-y-auto overflow-x-hidden">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
