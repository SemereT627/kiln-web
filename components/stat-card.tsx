import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StatCardVariant =
  | "neutral"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "blue";

const STAT_ICON_STYLES: Record<StatCardVariant, string> = {
  neutral: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
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
    <div className="rounded-2xl border bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("rounded-xl p-2.5", STAT_ICON_STYLES[variant])}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        {action}
      </div>
      <p className="text-sm text-muted-foreground leading-tight">{title}</p>
      <div className="text-2xl font-semibold tracking-tight leading-tight mt-1">
        {value}
      </div>
      {subtext && (
        <p className="text-xs text-muted-foreground/80 mt-1.5 leading-snug">
          {subtext}
        </p>
      )}
    </div>
  );
}
