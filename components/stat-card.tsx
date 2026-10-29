import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Semantic only — pick the variant that matches what the number *means*,
 * not whatever color looks nice next to the others. See lib/utils.ts /
 * globals.css for the underlying success/warning/danger/info tokens.
 */
export type StatCardVariant = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const STAT_ICON_STYLES: Record<StatCardVariant, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground dark:text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  variant,
  action,
}: {
  title: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  icon: LucideIcon;
  variant: StatCardVariant;
  action?: React.ReactNode;
}) {
  // Same anatomy as the dashboard metric cards (bento-stat-grid.tsx): label
  // left with the icon (and optional action) right, then value, then
  // supporting text pinned to the bottom so cards in a row line up.
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex h-8 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">
          {title}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              STAT_ICON_STYLES[variant],
            )}
          >
            <Icon className="size-4" strokeWidth={2} />
          </div>
        </div>
      </div>
      <div className="mt-0.5 text-3xl font-semibold leading-tight tracking-[-0.02em] tabular-nums">
        {value}
      </div>
      {subtext && (
        <p className="mt-auto pt-1.5 text-xs leading-relaxed text-muted-foreground">
          {subtext}
        </p>
      )}
    </div>
  );
}
