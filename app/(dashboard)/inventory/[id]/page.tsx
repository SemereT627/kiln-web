"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  Banknote,
  Box,
  PackagePlus,
  Pencil,
  ShoppingCart,
  Tag,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { StatCard } from "@/components/stat-card";
import { RestockForm } from "@/components/restock-form";
import { CeramicForm } from "@/components/ceramic-form";
import { useUser } from "@/components/user-provider";
import { formatEthiopian } from "@/lib/ethiopian-calendar";
import { cn, formatDate, formatDateTime, formatETB, formatNumber } from "@/lib/utils";

interface StockEntry {
  id: string;
  quantity: number;
  entryType: "Restock" | "Adjustment" | "Return";
  direction: "add" | "remove";
  reason: string | null;
  supplier: string | null;
  notes: string | null;
  createdAt: string;
}

interface SaleRow {
  id: string;
  quantity: number;
  priceAtSale: number | null;
  createdAt: string;
  orderId: string | null;
  orderPaymentMethod: "cash" | "bank_transfer" | "credit" | null;
  sellerName: string | null;
}

type HistoryTab = "movements" | "sales";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  credit: "Credit",
};

const TH_CLASS =
  "sticky top-0 z-10 bg-card text-[11px] uppercase tracking-wider font-semibold text-muted-foreground";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const userProfile = useUser();
  const isAdmin = userProfile?.role === "admin";
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<HistoryTab>("movements");
  const [restockOpen, setRestockOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: ceramic, isLoading, isError } = useQuery({
    queryKey: ["ceramics", id],
    queryFn: async () => {
      const res = await fetch(`/api/ceramics/${id}`);
      if (!res.ok) throw new Error("Failed to fetch product");
      return res.json();
    },
  });

  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ["restock", id],
    queryFn: async () => {
      const res = await fetch(`/api/ceramics/${id}/restock`);
      if (!res.ok) throw new Error("Failed to fetch stock movements");
      const json = await res.json();
      return (json.data || []) as StockEntry[];
    },
  });

  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ["sales", "ceramic", id],
    queryFn: async () => {
      const res = await fetch(`/api/sales?ceramicId=${id}&limit=-1`);
      if (!res.ok) throw new Error("Failed to fetch sales");
      const json = await res.json();
      return (json.data || []) as SaleRow[];
    },
  });

  // Running stock level over time: stock entries move it up/down, every sale
  // moves it down. Ends at the view's current_stock.
  const stockSeries = useMemo(() => {
    if (!entries || !sales) return [];
    const events = [
      ...entries.map((e) => ({
        at: e.createdAt,
        delta: e.direction === "remove" ? -e.quantity : e.quantity,
      })),
      ...sales.map((s) => ({ at: s.createdAt, delta: -s.quantity })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    let level = 0;
    return events.map((e) => {
      level += e.delta;
      return { at: e.at, stock: +level.toFixed(2) };
    });
  }, [entries, sales]);

  if (isLoading) return <ProductDetailSkeleton />;

  if (isError || !ceramic) {
    return (
      <div className="flex h-full flex-col gap-4">
        <BackLink />
        <EmptyState
          icon={Box}
          title="Product not found"
          description="It may have been deleted, or the link is wrong."
        />
      </div>
    );
  }

  const unit: string = ceramic.measurementUnit || "m²";
  const price: number | null =
    ceramic.pricePerUnit != null ? Number(ceramic.pricePerUnit) : null;
  const salesRevenue = (sales ?? []).reduce(
    (sum, s) => sum + s.quantity * (s.priceAtSale ?? 0),
    0,
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["ceramics"] });
    queryClient.invalidateQueries({ queryKey: ["restock", id] });
  };

  return (
    <div className="flex h-full flex-col animate-in fade-in duration-500">
      <div className="flex-1 min-h-0 -m-4 p-4 overflow-y-auto overflow-x-hidden space-y-4 no-scrollbar">
        {/* Header */}
        <div className="space-y-3">
          <BackLink />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
                  {ceramic.productId}
                </h1>
                <StockBadge stock={ceramic.currentStock} />
              </div>
              <p className="text-sm text-muted-foreground">
                {[ceramic.brand, ceramic.size, ceramic.finish]
                  .filter(Boolean)
                  .join(" · ")}
                {ceramic.name && ceramic.name !== ceramic.productId && (
                  <> · {ceramic.name}</>
                )}
              </p>
            </div>
            {isAdmin && (
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
                <Button className="gap-1.5" onClick={() => setRestockOpen(true)}>
                  <PackagePlus className="size-4" />
                  Add Restock
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Current stock"
            value={`${formatNumber(ceramic.currentStock)} ${unit}`}
            subtext={`of ${formatNumber(ceramic.initialStock)} ${unit} received`}
            icon={Box}
            variant="neutral"
          />
          <StatCard
            title="Total sold"
            value={`${formatNumber(ceramic.soldStock)} ${unit}`}
            subtext={
              sales
                ? `${sales.length} sale${sales.length !== 1 ? "s" : ""}`
                : undefined
            }
            icon={ShoppingCart}
            variant="primary"
          />
          <StatCard
            title="Sales revenue"
            value={formatETB(salesRevenue)}
            subtext="At recorded sale prices"
            icon={Banknote}
            variant="success"
          />
          <StatCard
            title={`Price / ${unit}`}
            value={price != null ? formatETB(price) : "—"}
            subtext={
              price != null && isAdmin
                ? `Stock value ${formatETB(price * Math.max(0, ceramic.currentStock))}`
                : price == null
                  ? "No price set on this type"
                  : undefined
            }
            icon={Tag}
            variant="info"
          />
        </div>

        {/* Stock over time + specs */}
        <div className="grid gap-3 lg:grid-cols-7">
          <Card className="lg:col-span-5 h-80 flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <CardHeader className="shrink-0">
              <CardTitle>Stock over time</CardTitle>
              <CardDescription>
                Running stock level after each restock, adjustment, return and
                sale.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pl-2">
              {loadingEntries || loadingSales ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : stockSeries.length < 2 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Not enough movements yet to chart.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stockSeries}>
                    <defs>
                      <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="at"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={40}
                      tickFormatter={(v) => formatDate(v)}
                      tick={{ fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${formatNumber(v, 0)} ${unit}`}
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
                      labelFormatter={(v) => formatDateTime(v)}
                      formatter={(v) => [`${formatNumber(Number(v))} ${unit}`, "Stock"]}
                    />
                    <Area
                      type="stepAfter"
                      dataKey="stock"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#stockFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <CardContent className="space-y-4">
              <ProductImage
                src={ceramic.imageUrl}
                alt={ceramic.name}
                className="aspect-4/3 w-full rounded-xl border border-border/60"
                iconSize="lg"
                sizes="(min-width: 1024px) 320px, 100vw"
                fit="cover"
              />
              <dl className="divide-y text-sm">
                <SpecRow label="Brand" value={ceramic.brand} />
                <SpecRow label="Size" value={ceramic.size} />
                <SpecRow label="Finish" value={ceramic.finish} />
                <SpecRow label="Unit" value={unit} />
                <SpecRow label="Registered" value={formatDate(ceramic.createdAt)} />
                <SpecRow label="Last updated" value={formatDateTime(ceramic.updatedAt)} />
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* History tables */}
        <Card className="gap-0 py-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div className="inline-flex gap-1 rounded-lg border bg-muted/30 p-1">
              {(
                [
                  { value: "movements", label: "Stock movements", count: entries?.length },
                  { value: "sales", label: "Sales", count: sales?.length },
                ] as const
              ).map((t) => {
                const active = tab === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTab(t.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                    {t.count !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                          active
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {tab === "sales" && sales && sales.length > 0 && (
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatNumber(sales.reduce((s, r) => s + r.quantity, 0))} {unit}{" "}
                · {formatETB(salesRevenue)}
              </p>
            )}
          </div>

          <div className="max-h-120 overflow-auto">
            {tab === "movements" ? (
              <MovementsTable entries={entries} loading={loadingEntries} unit={unit} />
            ) : (
              <SalesTable sales={sales} loading={loadingSales} unit={unit} />
            )}
          </div>
        </Card>
      </div>

      {isAdmin && (
        <>
          <RestockForm
            open={restockOpen}
            onOpenChange={setRestockOpen}
            product={ceramic}
            onSuccess={invalidateAll}
          />
          {editOpen && (
            <CeramicForm
              open={editOpen}
              onOpenChange={setEditOpen}
              initialData={ceramic}
              onSuccess={invalidateAll}
            />
          )}
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/inventory"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Inventory
    </Link>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function DateCell({ date }: { date: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">{formatDateTime(date)}</span>
      <span className="text-[11px] text-muted-foreground">
        {formatEthiopian(new Date(date))}
      </span>
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <Table>
      <TableBody>
        {[1, 2, 3, 4].map((i) => (
          <TableRow key={i} className="hover:bg-transparent h-13">
            {Array.from({ length: cols }).map((_, c) => (
              <TableCell key={c} className={c === 0 ? "pl-4" : undefined}>
                <Skeleton className="h-3.5 w-20" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MovementsTable({
  entries,
  loading,
  unit,
}: {
  entries: StockEntry[] | undefined;
  loading: boolean;
  unit: string;
}) {
  if (loading) return <TableSkeleton cols={4} />;
  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        icon={PackagePlus}
        title="No stock movements yet"
        description="Restocks, adjustments and returns will appear here."
      />
    );
  }
  return (
    <Table className="min-w-160">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(TH_CLASS, "pl-4")}>Date</TableHead>
          <TableHead className={TH_CLASS}>Type</TableHead>
          <TableHead className={cn(TH_CLASS, "text-right")}>Quantity</TableHead>
          <TableHead className={TH_CLASS}>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e) => {
          const remove = e.direction === "remove";
          return (
            <TableRow key={e.id} className="h-13">
              <TableCell className="pl-4">
                <DateCell date={e.createdAt} />
              </TableCell>
              <TableCell>
                <Badge
                  variant={e.entryType === "Restock" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {e.entryType}
                </Badge>
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold tabular-nums",
                  remove ? "text-destructive" : "text-success",
                )}
              >
                {remove ? "−" : "+"}
                {formatNumber(e.quantity)} {unit}
              </TableCell>
              <TableCell className="max-w-80 whitespace-normal text-sm text-muted-foreground">
                {[
                  e.reason && <span key="r" className="capitalize">{e.reason}</span>,
                  e.supplier && <span key="s">Supplier: {e.supplier}</span>,
                  e.notes && <span key="n">{e.notes}</span>,
                ]
                  .filter(Boolean)
                  .reduce<React.ReactNode[]>(
                    (acc, node, i) => (i ? [...acc, " · ", node] : [node]),
                    [],
                  )}
                {!e.reason && !e.supplier && !e.notes && "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SalesTable({
  sales,
  loading,
  unit,
}: {
  sales: SaleRow[] | undefined;
  loading: boolean;
  unit: string;
}) {
  if (loading) return <TableSkeleton cols={6} />;
  if (!sales || sales.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No sales yet"
        description="Sales of this product will appear here."
      />
    );
  }
  return (
    <Table className="min-w-180">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(TH_CLASS, "pl-4")}>Date</TableHead>
          <TableHead className={TH_CLASS}>Seller</TableHead>
          <TableHead className={TH_CLASS}>Source</TableHead>
          <TableHead className={cn(TH_CLASS, "text-right")}>Quantity</TableHead>
          <TableHead className={cn(TH_CLASS, "text-right")}>Unit price</TableHead>
          <TableHead className={cn(TH_CLASS, "pr-4 text-right")}>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map((s) => (
          <TableRow key={s.id} className="h-13">
            <TableCell className="pl-4">
              <DateCell date={s.createdAt} />
            </TableCell>
            <TableCell className="text-sm">{s.sellerName ?? "—"}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-[10px]">
                {s.orderId ? "Order" : "Direct sale"}
                {s.orderPaymentMethod && ` · ${PAYMENT_LABEL[s.orderPaymentMethod]}`}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatNumber(s.quantity)} {unit}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {s.priceAtSale != null ? formatETB(s.priceAtSale) : "—"}
            </TableCell>
            <TableCell className="pr-4 text-right font-semibold tabular-nums">
              {s.priceAtSale != null ? formatETB(s.quantity * s.priceAtSale) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-7">
        <Skeleton className="h-80 rounded-xl lg:col-span-5" />
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
