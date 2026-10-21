"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Box, AlertTriangle, XCircle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslations } from "next-intl";
import { useUser } from "@/components/user-provider";
import { BentoStatGrid } from "@/components/dashboard/bento-stat-grid";
import { StockBadge } from "@/components/stock-badge";

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          {eyebrow}
        </p>
        <h2 className="text-lg font-semibold tracking-tight mt-0.5">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

interface AlertItem {
  _id: string;
  name: string;
  productId: string;
  brand: string;
  size?: string | null;
  currentStock: number;
  measurementUnit: string | null;
}

// Shared between the "Attention Required" card and the low-stock modal so
// both render the exact same row instead of two drifting copies. Rendered
// inside a `divide-y` list; status is carried by the icon chip + badge only.
function AlertRow({ item }: { item: AlertItem }) {
  const unit = item.measurementUnit || "m²";
  const outOfStock = item.currentStock <= 0;
  const AlertIcon = outOfStock ? XCircle : AlertTriangle;
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
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
          {item.currentStock.toFixed(2)} {unit}
        </span>
        <StockBadge stock={item.currentStock} />
      </div>
    </div>
  );
}

function SectionHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-5 w-44" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

// Same style as AnalyticsSkeleton: solid blocks shaped like the real cards,
// laid out on the same grid as the loaded dashboard.
function DashboardSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 -m-5 p-5 overflow-hidden space-y-6">
        <section className="space-y-3">
          <SectionHeaderSkeleton />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl xl:col-span-3" />
            ))}
            <Skeleton className="h-68 rounded-2xl md:col-span-2 xl:col-span-6" />
            <div className="grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-6 xl:grid-cols-1">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          </div>
        </section>
        {[0, 1].map((i) => (
          <section key={i} className="space-y-3">
            <SectionHeaderSkeleton />
            <div className="grid gap-4 lg:grid-cols-7">
              <Skeleton className="h-115 rounded-2xl lg:col-span-4" />
              <Skeleton className="h-115 rounded-2xl lg:col-span-3" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const t = useTranslations("Dashboard");
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const [valueRevealed, setValueRevealed] = useState(false);
  const [lowStockOpen, setLowStockOpen] = useState(false);

  const { data: response, isLoading } = useQuery({
    queryKey: ["ceramics", "all"],
    queryFn: async () => {
      const res = await fetch("/api/ceramics?limit=-1");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
  });

  const data: any[] = response?.data || [];

  if (isLoading) return <DashboardSkeleton />;

  // Separate ZEKOLO (linear m) from regular tiles (m²)
  const sqmItems = data.filter((i) => (i.measurementUnit || "m²") === "m²");
  const linItems = data.filter((i) => i.measurementUnit === "m");
  const otherItems = data.filter((i) => i.measurementUnit === "pcs");

  const totalSqmStock = sqmItems.reduce((a, i) => a + i.currentStock, 0);
  const totalSqmSold = sqmItems.reduce((a, i) => a + i.soldStock, 0);
  const totalLinStock = linItems.reduce((a, i) => a + i.currentStock, 0);
  const totalLinSold = linItems.reduce((a, i) => a + i.soldStock, 0);

  // Total stock value (qty × price_per_unit where available)
  const totalStockValue = data.reduce((acc, i) => {
    if (i.pricePerUnit != null) return acc + i.currentStock * i.pricePerUnit;
    return acc;
  }, 0);

  const lowStockItems = data
    .filter((i) => i.currentStock > 0 && i.currentStock <= 5)
    .sort((a, b) => a.currentStock - b.currentStock);
  const lowStockCount = lowStockItems.length;

  // Chart: top 8 m² products by current stock, excluding ZEKOLO
  const chartData = [...sqmItems]
    .sort((a, b) => b.currentStock - a.currentStock)
    .slice(0, 8)
    .map((i) => ({
      name: i.productId,
      stock: +i.currentStock.toFixed(2),
      sold: +i.soldStock.toFixed(2),
    }));

  // Alerts: low or out-of-stock products, worst first
  const alerts = data
    .filter((i) => i.currentStock <= 5)
    .sort((a, b) => a.currentStock - b.currentStock);
  const topAlert = alerts[0]
    ? {
        name: alerts[0].productId,
        stock: alerts[0].currentStock,
        unit: alerts[0].measurementUnit || "m²",
      }
    : null;

  // Stock share by brand (m² items)
  const brandMap = new Map<string, number>();
  for (const i of sqmItems) {
    const key = i.brand || "Unknown";
    brandMap.set(key, (brandMap.get(key) ?? 0) + i.currentStock);
  }
  // Top 3 brands, with the remainder folded into "Other" so shares sum to 100%
  const sortedBrands = [...brandMap.entries()].sort((a, b) => b[1] - a[1]);
  const brandShare: { name: string; value: number; isOther?: boolean }[] =
    sortedBrands.length > 4
      ? [
          ...sortedBrands.slice(0, 3).map(([name, value]) => ({ name, value: +value.toFixed(2) })),
          {
            name: "__other__",
            value: +sortedBrands.slice(3).reduce((a, [, v]) => a + v, 0).toFixed(2),
            isOther: true,
          },
        ]
      : sortedBrands.map(([name, value]) => ({ name, value: +value.toFixed(2) }));

  // Stock by tile size (m² items): stock, product count and all-time sold
  // per size, ranked by stock.
  const sizeMap = new Map<string, { stock: number; sold: number; products: number }>();
  for (const i of sqmItems) {
    const key = i.size || "Unknown";
    const entry = sizeMap.get(key) ?? { stock: 0, sold: 0, products: 0 };
    entry.stock += i.currentStock;
    entry.sold += i.soldStock;
    entry.products += 1;
    sizeMap.set(key, entry);
  }
  const sizeRows = [...sizeMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.stock - a.stock);
  const sizeTotal = sizeRows.reduce((a, r) => a + Math.max(0, r.stock), 0);
  const sizeMax = Math.max(...sizeRows.map((r) => r.stock), 1);

  const outOfStockCount = alerts.filter((i) => i.currentStock <= 0).length;
  const lowOnlyCount = alerts.length - outOfStockCount;

  return (
    <div className="flex h-full flex-col animate-in fade-in duration-500">
      {/* Bleeds to the layout's padded edges so content scrolls under the
          top bar and to the very bottom instead of being clipped by <main>'s
          padding, and card focus rings at the edges aren't cut off. */}
      <div className="flex-1 min-h-0 -m-5 p-5 overflow-y-auto overflow-x-hidden space-y-6 no-scrollbar">
        <section className="space-y-3">
          <SectionHeader
            eyebrow={t("overview.eyebrow")}
            title={t("overview.title")}
            description={t("overview.description")}
          />
          <BentoStatGrid
            totalProducts={data.length}
            tileStock={totalSqmStock}
            tileSold={totalSqmSold}
            tileProductCount={sqmItems.length}
            lowStockCount={lowStockCount}
            topAlert={topAlert}
            onLowStockClick={() => setLowStockOpen(true)}
            brandShare={brandShare}
            stockValue={totalStockValue}
            stockValueRevealed={valueRevealed}
            onToggleStockValue={() => setValueRevealed((v) => !v)}
            isAdmin={isAdmin}
            totalSold={totalSqmSold}
            skirtingStock={totalLinStock}
            skirtingSold={totalLinSold}
            skirtingProductCount={linItems.length}
            otherPcs={otherItems.reduce((a, i) => a + i.currentStock, 0)}
          />
        </section>

        {/* Charts + Recent Inventory */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow={t("trends.eyebrow")}
            title={t("trends.title")}
            description={t("trends.description")}
          />
          <div className="grid gap-4 lg:grid-cols-7 items-stretch">
            {/* Bar chart — top tile products */}
            <Card className="lg:col-span-4 h-115 flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <CardHeader className="shrink-0">
                <CardTitle>{t("topTileProducts.title")}</CardTitle>
                <CardDescription>
                  {t("topTileProducts.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 pl-2">
                <div className="h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={6}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="name"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}m²`}
                        tick={{ fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "10px",
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                          boxShadow: "0 8px 24px -8px rgba(0,0,0,0.2)",
                        }}
                        cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                        formatter={(v, name) => [`${v} m²`, name]}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        height={32}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value) => (
                          <span className="text-xs text-foreground">
                            {value}
                          </span>
                        )}
                      />
                      <Bar
                        dataKey="stock"
                        name={t("topTileProducts.currentStock")}
                        fill="var(--chart-1)"
                        radius={[6, 6, 0, 0]}
                        barSize={22}
                      />
                      <Bar
                        dataKey="sold"
                        name={t("topTileProducts.totalSold")}
                        fill="var(--chart-2)"
                        radius={[6, 6, 0, 0]}
                        barSize={22}
                        opacity={0.85}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent inventory */}
            <Card className="lg:col-span-3 h-115 flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <CardHeader className="shrink-0">
                <CardTitle>{t("recentInventory.title")}</CardTitle>
                <CardDescription>
                  {t("recentInventory.description")}
                </CardDescription>
                <CardAction>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:bg-primary/10 hover:text-primary"
                    asChild
                  >
                    <Link href="/inventory">
                      {t("recentInventory.viewAll")}
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto pb-4">
                <div className="divide-y">
                  {data.slice(0, 5).map((item: any) => {
                    const unit = item.measurementUnit || "m²";
                    return (
                      <div
                        key={item._id}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Box className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {item.brand} · {item.size}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-semibold tabular-nums">
                            {item.currentStock.toFixed(2)} {unit}
                          </span>
                          {/* Only flag problems — a badge on every row is noise */}
                          {item.currentStock <= 5 && (
                            <StockBadge stock={item.currentStock} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Second row: Pie + Low stock list */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow={t("health.eyebrow")}
            title={t("health.title")}
            description={t("health.description")}
          />
          <div className="grid gap-4 lg:grid-cols-7 items-stretch">
            {/* Stock by tile size — ranked bars (easier to compare than a donut)
                with product count and all-time sales for context */}
            <Card className="lg:col-span-4 h-115 flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <CardHeader className="shrink-0">
                <CardTitle>{t("stockByTileSize.title")}</CardTitle>
                <CardDescription>
                  {t("stockByTileSize.description")}
                </CardDescription>
                <CardAction className="text-right">
                  <p className="text-base font-semibold leading-tight tabular-nums">
                    {sizeTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} m²
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("stockByTileSize.totalStock")}
                  </p>
                </CardAction>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto">
                {sizeRows.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {t("stockByTileSize.noData")}
                  </p>
                ) : (
                  <ul className="space-y-5">
                    {sizeRows.map((r) => {
                      const pct = sizeTotal > 0 ? (Math.max(0, r.stock) / sizeTotal) * 100 : 0;
                      return (
                        <li key={r.name}>
                          <div className="flex items-center gap-3">
                            <span className="w-14 shrink-0 text-sm font-semibold">{r.name}</span>
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.max(0, (r.stock / sizeMax) * 100)}%` }}
                              />
                            </div>
                            <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                              {r.stock.toLocaleString("en-US", { maximumFractionDigits: 0 })} m²
                            </span>
                            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                              {pct > 0 && pct < 1 ? "<1%" : `${Math.round(pct)}%`}
                            </span>
                          </div>
                          <p className="mt-1 pl-17 text-xs text-muted-foreground">
                            {t("stockByTileSize.rowDetail", {
                              count: r.products,
                              sold: r.sold.toLocaleString("en-US", { maximumFractionDigits: 0 }),
                            })}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Low / out of stock list */}
            <Card className="lg:col-span-3 h-115 flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <CardHeader className="shrink-0">
                <CardTitle>{t("attentionRequired.title")}</CardTitle>
                <CardDescription>
                  {t("attentionRequired.description")}
                </CardDescription>
                {alerts.length > 0 && (
                  <CardAction className="flex items-center gap-1.5">
                    {outOfStockCount > 0 && (
                      <Badge className="bg-destructive/10 text-destructive tabular-nums">
                        {t("attentionRequired.outCount", { count: outOfStockCount })}
                      </Badge>
                    )}
                    {lowOnlyCount > 0 && (
                      <Badge className="bg-warning/15 text-warning-foreground dark:text-warning tabular-nums">
                        {t("attentionRequired.lowCount", { count: lowOnlyCount })}
                      </Badge>
                    )}
                  </CardAction>
                )}
              </CardHeader>
              {/* Bottom fade signals the list scrolls; extra bottom padding
                  lets the last row clear the fade when scrolled to the end. */}
              <CardContent className="flex-1 min-h-0 overflow-y-auto pb-8 [mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]">
                {(() => {
                  if (alerts.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                        <div className="rounded-full bg-success/10 p-2.5">
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {t("attentionRequired.allGood")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("attentionRequired.allGoodDescription")}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="divide-y">
                      {alerts.map((item) => (
                        <AlertRow key={item._id} item={item} />
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <Dialog open={lowStockOpen} onOpenChange={setLowStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("lowStockModal.title")}</DialogTitle>
            <DialogDescription>
              {t("lowStockModal.description", { count: lowStockCount })}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-100 divide-y overflow-y-auto pr-1">
            {lowStockItems.map((item) => (
              <AlertRow key={item._id} item={item} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
