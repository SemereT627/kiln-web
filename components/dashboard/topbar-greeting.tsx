"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUser } from "@/components/user-provider";
import { LiveClock } from "@/components/dashboard/live-clock";

function isDashboard(pathname: string) {
  const localeless = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  return localeless === "/dashboard" || localeless === "/";
}

/**
 * Dashboard greeting rendered inside the shared top bar, so the dashboard
 * doesn't spend a second header's worth of height on it. Renders nothing on
 * other pages — they carry their own page titles.
 */
export function TopbarGreeting() {
  const t = useTranslations("Dashboard");
  const user = useUser();
  const pathname = usePathname();

  if (!isDashboard(pathname)) return null;

  const firstName = (user?.full_name || "").split(" ")[0];

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="relative flex size-1.5 shrink-0"
        role="img"
        aria-label={t("liveDashboard")}
        title={t("liveDashboard")}
      >
        <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-success" />
      </span>
      <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
        {firstName ? t("welcomeBack", { name: firstName }) : t("greetingFallback")}
      </h1>
    </div>
  );
}

export function TopbarClock() {
  const pathname = usePathname();
  if (!isDashboard(pathname)) return null;
  return (
    <>
      <LiveClock />
      <div className="mx-2 hidden h-6 w-px bg-border md:block" aria-hidden="true" />
    </>
  );
}
