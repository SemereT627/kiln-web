import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TopNav } from "@/components/top-nav";
import { Lexend } from "next/font/google";

// Trial: Lexend for the dashboard only. Swaps the body font variable on :root
// (not a wrapper) so dialogs and toasts, which portal to <body>, use it too.
// Rollback = delete these lines and the <style> below.
const lexend = Lexend({ subsets: ["latin"] });

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The provider still drives the phone's slide-in menu; desktop uses the
    // top nav and renders no sidebar.
    <SidebarProvider>
      <style>{`:root { --font-body: ${lexend.style.fontFamily}; }`}</style>
      <div className="flex h-svh w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <TopNav />
          <main className="flex-1 relative">
            <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-4 py-4 md:px-8">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
