import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSelector } from "@/components/locale-selector";
import { NotificationsBell } from "@/components/notifications-bell";

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
            <div className="flex-1" />
            <ThemeToggle className="size-11" />
            <LocaleSelector className="size-11" />
            <NotificationsBell className="size-11" />
          </header>
          <main className="flex-1 relative">
            <div className="absolute inset-0 p-6 md:p-8 overflow-y-auto overflow-x-hidden">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
