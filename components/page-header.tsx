"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { findNavTrail } from "@/components/nav-config";
import { cn } from "@/lib/utils";

/**
 * Page title + description with the page's primary actions. The navy icon
 * chip is the page's nav icon unless `icon` is given.
 *
 * Default: a row, actions pinned right. `card`: the white card at the top of
 * a PageLayout's left column — actions fill a row under the description, and
 * `children` (search, filters) sit below a dashed line.
 */
export function PageHeader({
  title,
  description,
  actions,
  icon,
  wrap,
  card,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: LucideIcon;
  /** Let wide actions (filters, date pickers) drop below the title. */
  wrap?: boolean;
  card?: boolean;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const path = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  const Icon = icon ?? (findNavTrail(path)?.item.icon as LucideIcon | undefined);

  const heading = (
    <div className="flex min-w-0 items-start gap-3">
      {Icon && (
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-ink-foreground">
          <Icon className="size-4" />
        </span>
      )}
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );

  if (card) {
    return (
      <div className="rounded-[20px] bg-card p-5">
        {heading}
        {actions && (
          <div className="mt-4 flex flex-wrap gap-2 *:flex-1 empty:hidden">{actions}</div>
        )}
        {children && (
          <div className="mt-4 flex flex-col gap-3 border-t border-dashed pt-4">{children}</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex shrink-0 items-start justify-between gap-3", wrap && "flex-wrap")}>
      {heading}
      {actions && (
        <div className={cn("flex items-center gap-2", wrap ? "flex-wrap" : "shrink-0")}>{actions}</div>
      )}
    </div>
  );
}
