import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in-up flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="mb-1 rounded-full bg-muted p-3.5 ring-8 ring-muted/40">
        <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-70">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
