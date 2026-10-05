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
  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs transition-all duration-200 md:p-3.5 md:hover:-translate-y-0.5 md:hover:shadow-md">
      <div className="flex items-start justify-between mb-1.5 md:mb-2">
        <div className={cn("rounded-lg p-1.5 shrink-0", STAT_ICON_STYLES[variant])}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        {action}
      </div>
      <div className="text-2xl font-semibold tracking-tight leading-tight">
        {value}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
        {title}
      </p>
      <p
        className={cn(
          "hidden text-xs text-muted-foreground/80 mt-0.5 leading-snug md:block",
          !subtext && "invisible",
        )}
      >
        {subtext ?? " "}
      </p>
    </div>
  );
}
