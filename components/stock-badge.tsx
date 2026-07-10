import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StockBadgeProps {
  stock: number;
  size?: "sm" | "default";
}

export function StockBadge({ stock, size = "default" }: StockBadgeProps) {
  const cls = size === "sm" ? "h-5 px-2 text-[10px]" : "";

  if (stock <= 0)
    return (
      <Badge variant="destructive" className={cls}>
        Out of Stock
      </Badge>
    );

  if (stock < 5)
    return (
      <Badge
        className={cn(
          "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
          cls,
        )}
      >
        Low Stock
      </Badge>
    );

  return (
    <Badge
      className={cn(
        "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400",
        cls,
      )}
    >
      In Stock
    </Badge>
  );
}
