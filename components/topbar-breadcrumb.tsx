"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { findNavTrail } from "@/components/nav-config";

/**
 * Section / page breadcrumb for the shared top bar, resolved from the same
 * nav config the sidebar renders. The dashboard shows its greeting there
 * instead (see TopbarGreeting), so this renders nothing on it.
 */
export function TopbarBreadcrumb() {
  const tGroups = useTranslations("Sidebar.groups");
  const tItems = useTranslations("Sidebar.items");
  const pathname = usePathname();
  const path = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";

  if (path === "/dashboard" || path === "/") return null;

  // Profile lives in the account menu, not the sidebar, so it has no section.
  const trail = findNavTrail(path);
  const section = trail ? tGroups(trail.groupKey) : null;
  const page = trail
    ? tItems(trail.item.titleKey)
    : path === "/profile"
      ? tItems("profile")
      : null;

  if (!page) return null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {section && (
          <li className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
            <span className="whitespace-nowrap">{section}</span>
            <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          </li>
        )}
        <li className="min-w-0">
          <span aria-current="page" className="block truncate font-semibold text-foreground">
            {page}
          </span>
        </li>
      </ol>
    </nav>
  );
}
