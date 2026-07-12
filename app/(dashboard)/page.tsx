"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Box, AlertTriangle, LayoutGrid } from "lucide-react";
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
import { useUser } from "@/components/user-provider";
import { BentoStatGrid } from "@/components/dashboard/bento-stat-grid";
import { AmbientCanvas } from "@/components/dashboard/ambient-canvas";
import { LiveClock } from "@/components/dashboard/live-clock";

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#a78bfa",
  "#34d399",
  "#fb923c",
];

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <Badge variant="destructive">Out of stock</Badge>;
  if (stock < 5)
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Low</Badge>
    );
  return (
    <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">
      In Stock
    </Badge>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border shadow-md">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm border">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-75" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3 shadow-sm border">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const [valueRevealed, setValueRevealed] = useState(false);

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

  const lowStockCount = data.filter(
    (i) => i.currentStock > 0 && i.currentStock < 5,
  ).length;

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
    .filter((i) => i.currentStock < 5)
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

  return (
    <div className="flex h-full flex-col animate-in fade-in duration-500">
      <div className="relative shrink-0 -mx-6 -mt-6 px-6 py-4 md:-mx-8 md:-mt-8 overflow-hidden border-b bg-background/80">
        <AmbientCanvas />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          </div>
          <LiveClock />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-6 pt-4">
        <BentoStatGrid
          totalProducts={data.length}
          tileStock={totalSqmStock}
          tileSold={totalSqmSold}
          tileProductCount={sqmItems.length}
          sparklineData={sparklineData}
          lowStockCount={lowStockCount}
          topAlert={topAlert}
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

        {/* Charts + Recent Inventory */}
        <div className="grid gap-4 lg:grid-cols-7">
          {/* Bar chart — top tile products */}
          <Card className="lg:col-span-4 shadow-sm border">
            <CardHeader>
              <CardTitle>Top Tile Products — Stock vs Sold</CardTitle>
              <CardDescription>
                Top 8 ceramic tile products by current stock (m²). Skirting
                excluded.
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-70">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
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
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      formatter={(v) => [`${v} m²`]}
                    />
                    <Legend verticalAlign="top" align="right" height={32} />
                    <Bar
                      dataKey="stock"
                      name="Current Stock"
                      fill="var(--chart-1)"
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                    />
                    <Bar
                      dataKey="sold"
                      name="Total Sold"
                      fill="var(--chart-2)"
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                      opacity={0.85}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent inventory */}
          <Card className="lg:col-span-3 shadow-sm border">
            <CardHeader>
              <CardTitle>Recent Inventory</CardTitle>
              <CardDescription>
                Latest products added or updated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.slice(0, 6).map((item: any) => {
                  const unit = item.measurementUnit || "m²";
                  return (
                    <div key={item._id} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
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

        {/* Second row: Pie + Low stock list */}
        <div className="grid gap-4 lg:grid-cols-7 items-start">
          {/* Pie: stock distribution by tile size */}
          <Card className="lg:col-span-3 shadow-sm border max-h-115">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                Stock by Tile Size
              </CardTitle>
              <CardDescription>
                Current m² stock distribution across tile sizes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-115 w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(v) => [`${v} m²`]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (
                        <span className="text-xs text-muted-foreground">
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Low / out of stock list */}
          <Card className="lg:col-span-4 shadow-sm border flex flex-col max-h-115">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Attention Required
              </CardTitle>
              <CardDescription>
                Products that are low or out of stock.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto">
              {(() => {
                if (alerts.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      All products are well-stocked.
                    </p>
                  );
                }
                return (
                  <div className="space-y-2">
                    {alerts.map((item: any) => {
                      const unit = item.measurementUnit || "m²";
                      return (
                        <div
                          key={item._id}
                          className="flex items-center justify-between py-1.5 border-b border-dashed last:border-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {item.name}
                            </p>
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
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
