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
import { Box, AlertTriangle, XCircle, LayoutGrid, ArrowUpRight, CheckCircle2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useTranslations } from "next-intl";
import { useUser } from "@/components/user-provider";
import { BentoStatGrid } from "@/components/dashboard/bento-stat-grid";
import { LiveClock } from "@/components/dashboard/live-clock";
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
    <div className="flex items-end justify-between gap-4 px-0.5">
      <div>
        <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
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

// Cycles through the 5 chart tokens rather than falling back to
// one-off hex swatches once a chart has more than 5 slices.
const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface AlertItem {
  _id: string;
  name: string;
  productId: string;
  brand: string;
  currentStock: number;
  measurementUnit: string | null;
}

// Shared between the "Attention Required" card and the low-stock modal so
// both render the exact same row instead of two drifting copies.
function AlertRow({ item }: { item: AlertItem }) {
  const unit = item.measurementUnit || "m²";
  const outOfStock = item.currentStock <= 0;
  const AlertIcon = outOfStock ? XCircle : AlertTriangle;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-2.5 transition-colors",
        outOfStock
          ? "border-destructive/20 bg-destructive/5 hover:bg-destructive/10"
          : "border-warning/25 bg-warning/10 hover:bg-warning/15",
      )}
    >
      <AlertIcon
        className={cn(
          "h-4 w-4 shrink-0",
          outOfStock ? "text-destructive" : "text-warning-foreground dark:text-warning",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.productId} · {item.brand}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <span className="text-sm tabular-nums font-semibold">
          {item.currentStock.toFixed(2)} {unit}
        </span>
        <StockBadge stock={item.currentStock} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 -mx-6 -mt-6 px-6 py-4 md:-mx-8 md:-mt-8 border-b">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-28 shrink-0" />
        </div>
      </div>
      <div className="flex-1 min-h-0 space-y-8 pt-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-12">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="lg:col-span-3">
                <CardHeader className="pb-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-7 w-24 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-70" />
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <Skeleton className="h-5 w-36" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
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
  const brandShare = [...brandMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, value]) => ({ name, value: +value.toFixed(2) }));

  // Sparkline: top 5 m² products by current stock
  const sparklineData = chartData
    .slice(0, 5)
    .map((c) => ({ name: c.name, stock: c.stock }));

  // Pie: breakdown by ceramic type size (m² items)
  const typeMap = new Map<string, number>();
  for (const i of sqmItems) {
    const key = i.size || "Unknown";
    typeMap.set(key, (typeMap.get(key) ?? 0) + i.currentStock);
  }
  const pieData = [...typeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value: +value.toFixed(2) }));

  const firstName = (user?.full_name || "").split(" ")[0];

  return (
    <div className="flex h-full flex-col animate-in fade-in duration-500">
      <div className="relative shrink-0 -mx-6 -mt-6 px-6 py-5 md:-mx-8 md:-mt-8 overflow-hidden border-b bg-background/80">
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("liveDashboard")}
              </p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {firstName ? t("welcomeBack", { name: firstName }) : t("greetingFallback")}
            </h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              {t("subtitle")}
            </p>
          </div>
          <LiveClock />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-8 pt-6 pb-8 no-scrollbar">
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
            sparklineData={sparklineData}
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
            <Card className="lg:col-span-4 h-115 flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.12)]">
              <CardHeader className="shrink-0">
                <CardTitle>{t("topTileProducts.title")}</CardTitle>
                <CardDescription>
                  {t("topTileProducts.description")}
                </CardDescription>
                <CardAction>
                  <Badge variant="outline" className="font-normal">
                    {t("topTileProducts.productsCount", { count: chartData.length })}
                  </Badge>
                </CardAction>
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
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        fontSize={11}
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
                        formatter={(v) => [`${v} m²`]}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        height={32}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12 }}
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
            <Card className="lg:col-span-3 h-115 flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.12)]">
              <CardHeader className="shrink-0">
                <CardTitle>{t("recentInventory.title")}</CardTitle>
                <CardDescription>
                  {t("recentInventory.description")}
                </CardDescription>
                <CardAction>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/inventory">
                      {t("recentInventory.viewAll")}
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto pb-4">
                <div className="space-y-1">
                  {data.slice(0, 6).map((item: any) => {
                    const unit = item.measurementUnit || "m²";
                    return (
                      <div
                        key={item._id}
                        className="flex items-center gap-3 -mx-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <Box className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-none truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.productId} · {item.size}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-semibold tabular-nums">
                            {item.currentStock.toFixed(2)} {unit}
                          </span>
                          <StockBadge stock={item.currentStock} />
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
            {/* Pie: stock distribution by tile size */}
            <Card className="lg:col-span-3 h-115 flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.12)]">
              <CardHeader className="shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-primary" />
                  {t("stockByTileSize.title")}
                </CardTitle>
                <CardDescription>
                  {t("stockByTileSize.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <div className="relative h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="46%"
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                            stroke="var(--card)"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "10px",
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                          boxShadow: "0 8px 24px -8px rgba(0,0,0,0.2)",
                        }}
                        formatter={(v) => [`${v} m²`]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                          <span className="text-xs text-muted-foreground">
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[calc(100%-2.25rem)] flex-col items-center justify-center">
                    <span className="text-xl font-semibold tracking-tight">
                      {totalSqmStock.toFixed(0)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {t("stockByTileSize.total")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Low / out of stock list */}
            <Card className="lg:col-span-4 h-115 flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.12)]">
              <CardHeader className="shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning-foreground dark:text-warning" />
                  {t("attentionRequired.title")}
                </CardTitle>
                <CardDescription>
                  {t("attentionRequired.description")}
                </CardDescription>
                <CardAction>
                  <Badge
                    variant={alerts.length > 0 ? undefined : "outline"}
                    className={
                      alerts.length > 0
                        ? "bg-warning/15 text-warning-foreground dark:text-warning"
                        : "font-normal"
                    }
                  >
                    {alerts.length}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto pb-4">
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
                    <div className="space-y-2">
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
          <div className="max-h-100 space-y-2 overflow-y-auto pr-1">
            {lowStockItems.map((item) => (
              <AlertRow key={item._id} item={item} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
