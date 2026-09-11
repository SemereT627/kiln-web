import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_STYLES = {
  default: "bg-muted ring-muted/40 text-muted-foreground",
  warning: "bg-warning/10 ring-warning/10 text-warning-foreground dark:text-warning",
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: keyof typeof ICON_STYLES;
}) {
  return (
    <div className="animate-fade-in-up flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div
        className={cn(
          "mb-1 rounded-full p-3.5 ring-8",
          ICON_STYLES[variant],
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-70">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
