"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AlertTriangle, XCircle } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/components/user-provider";
import { StockBadge } from "@/components/stock-badge";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { StockGaugeCard } from "@/components/dashboard/stock-gauge-card";
import { OrdersCard } from "@/components/dashboard/orders-card";
import { SalesBreakdownCard } from "@/components/dashboard/sales-breakdown-card";
import { TopProductsCard } from "@/components/dashboard/top-products-card";
import { SellThroughCard } from "@/components/dashboard/sell-through-card";
import { addisToday, useSalesDays } from "@/components/dashboard/sales-data";

/** The fields of GET /api/ceramics this page reads. */
interface Ceramic {
  _id: string;
  name: string;
  productId: string;
  brand: string | null;
  size?: string | null;
  imageUrl?: string | null;
  currentStock: number;
  soldStock: number;
  pricePerUnit?: number | null;
  measurementUnit: string | null;
}

// Low = 1–5 units left, out = nothing left; everything above is in stock.
const LOW_STOCK_MAX = 5;

// Shared by the attention dialog rows. Status is carried by the icon chip
// + badge only.
function AlertRow({ item }: { item: Ceramic }) {
  const unit = item.measurementUnit || "m²";
  const outOfStock = item.currentStock <= 0;
  const AlertIcon = outOfStock ? XCircle : AlertTriangle;
  return (
    <Link
      href={`/inventory/${item._id}`}
      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          outOfStock
            ? "bg-destructive/10 text-destructive"
            : "bg-warning/15 text-warning-foreground dark:text-warning",
        )}
      >
        <AlertIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {item.brand}
          {item.size ? ` · ${item.size}` : ""}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={cn(
            "text-sm tabular-nums font-semibold",
            outOfStock && "text-muted-foreground",
          )}
        >
          {formatNumber(item.currentStock)} {unit}
        </span>
        <StockBadge stock={item.currentStock} />
      </div>
    </Link>
  );
}

// Solid blocks shaped like the real cards, on the same grid as the page.
function DashboardSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 rounded-[20px]" />
        <Skeleton className="h-80 rounded-[20px]" />
        <Skeleton className="h-96 rounded-[20px]" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-112 rounded-[20px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-[20px]" />
          <Skeleton className="h-80 rounded-[20px]" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const t = useTranslations("Dashboard");
  const user = useUser();
  const isAdmin = user?.role === "admin";
  // Viewers can't read orders (GET /api/orders is admin + seller only).
  const canSeeOrders = !!user && user.role !== "viewer";
  const [valueRevealed, setValueRevealed] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const ceramics = useQuery({
    queryKey: ["ceramics", "all"],
    queryFn: async () => {
      const res = await fetch("/api/ceramics?limit=-1");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json() as Promise<{ data: Ceramic[] }>;
    },
  });
  const sales = useSalesDays();

  if (ceramics.isLoading) return <DashboardSkeleton />;

  const data = ceramics.data?.data ?? [];
  const salesDays = sales.data?.days ?? [];
  const today = sales.data?.today ?? addisToday();
  const salesFrom = sales.data?.from ?? today;

  const tiles = data.filter((i) => (i.measurementUnit || "m²") === "m²");
  const totalTileSold = tiles.reduce((a, i) => a + i.soldStock, 0);

  // Total stock value (qty × price_per_unit where available) — admin only.
  const totalStockValue = data.reduce(
    (acc, i) => (i.pricePerUnit != null ? acc + i.currentStock * i.pricePerUnit : acc),
    0,
  );

  // Stock status counts, and the low/out list worst first.
  const alerts = data
    .filter((i) => i.currentStock <= LOW_STOCK_MAX)
    .sort((a, b) => a.currentStock - b.currentStock);
  const outCount = alerts.filter((i) => i.currentStock <= 0).length;
  const lowCount = alerts.length - outCount;

  // All-time tile sales per brand, top 3.
  const brandSold = new Map<string, number>();
  for (const i of tiles) {
    const key = i.brand || "—";
    brandSold.set(key, (brandSold.get(key) ?? 0) + i.soldStock);
  }
  const topBrands = [...brandSold.entries()]
    .map(([name, sold]) => ({ name, sold }))
    .filter((b) => b.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 3);

  // Tile sold vs in stock per size, biggest total first.
  const sizeMap = new Map<string, { sold: number; stock: number }>();
  for (const i of tiles) {
    const key = i.size || "—";
    const e = sizeMap.get(key) ?? { sold: 0, stock: 0 };
    e.sold += Math.max(0, i.soldStock);
    e.stock += Math.max(0, i.currentStock);
    sizeMap.set(key, e);
  }
  const sizes = [...sizeMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.sold + b.stock - (a.sold + a.stock));

  return (
    // On wide screens the dashboard fits the window: columns fill the height
    // and long content scrolls inside its card, not the page.
    <div className="animate-in fade-in duration-500 xl:h-full">
      <div className="grid gap-4 xl:h-full xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        {/* Left column */}
        <div className="no-scrollbar flex min-w-0 flex-col gap-4 xl:min-h-0 xl:overflow-y-auto">
          <WorkspaceCard
            productCount={data.length}
            isAdmin={isAdmin}
            stockValue={totalStockValue}
            valueRevealed={valueRevealed}
            onToggleValue={() => setValueRevealed((v) => !v)}
          />
          <StockGaugeCard
            inStock={data.length - alerts.length}
            low={lowCount}
            out={outCount}
            onOpenList={() => setAlertsOpen(true)}
          />
          <OrdersCard
            className="xl:flex-1"
            showOrders={canSeeOrders}
            days={salesDays}
            today={today}
            from={salesFrom}
            updatedAt={sales.dataUpdatedAt || undefined}
            onRefresh={() => {
              sales.refetch();
              ceramics.refetch();
            }}
          />
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-4 xl:min-h-0">
          <SalesBreakdownCard
            totalSold={totalTileSold}
            topBrands={topBrands}
            days={salesDays}
            today={today}
            isAdmin={isAdmin}
          />
          <div className="grid gap-4 lg:grid-cols-2 xl:min-h-0 xl:flex-1">
            <TopProductsCard
              className="min-h-0"
              totalSold={totalTileSold}
              products={tiles.map((i) => ({
                id: i._id,
                name: i.name,
                imageUrl: i.imageUrl ?? null,
                sold: i.soldStock,
              }))}
            />
            <SellThroughCard className="min-h-0" sizes={sizes} isAdmin={isAdmin} />
          </div>
        </div>
      </div>

      <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("attentionRequired.title")}</DialogTitle>
            <DialogDescription>{t("attentionRequired.description")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-100 divide-y overflow-y-auto pr-1">
            {alerts.map((item) => (
              <AlertRow key={item._id} item={item} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
