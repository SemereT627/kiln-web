import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StockBadgeProps {
  stock: number;
  size?: "sm" | "default";
}

function Dot({ className }: { className: string }) {
  return <span className={cn("size-1.5 rounded-full", className)} />;
}

export function StockBadge({ stock, size = "default" }: StockBadgeProps) {
  const cls = size === "sm" ? "h-5 px-2 text-[10px]" : "";

  if (stock <= 0)
    return (
      <Badge variant="destructive" className={cn("gap-1.5", cls)}>
        <Dot className="bg-destructive" />
        Out of Stock
      </Badge>
    );

  if (stock <= 5)
    return (
      <Badge
        className={cn(
          "gap-1.5 bg-warning/15 text-warning-foreground hover:bg-warning/15 dark:text-warning",
          cls,
        )}
      >
        <Dot className="bg-warning" />
        Low Stock
      </Badge>
    );

  return (
    <Badge
      className={cn(
        "gap-1.5 bg-success/15 text-success hover:bg-success/15",
        cls,
      )}
    >
      <Dot className="bg-success" />
      In Stock
    </Badge>
  );
}
