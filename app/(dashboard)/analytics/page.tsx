"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Banknote,
  Layers,
  Receipt,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Hourglass,
  Snail,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/date-range-picker";
import { EmptyState } from "@/components/empty-state";
import { cn, formatNumber, formatETB } from "@/lib/utils";

// ── Types (mirror GET /api/analytics) ──────────────────────────────────

type Unit = "m²" | "m" | "pcs";

interface Totals {
  revenue: number;
  tileSqm: number;
  skirtingM: number;
  pieces: number;
  transactions: number;
}

interface HealthItem {
  id: string;
  productId: string;
  name: string;
  brand: string;
  unit: Unit;
  currentStock: number;
  soldInRange: number;
  dailyPace: number;
  daysOfCover: number | null;
  sellThrough: number;
}

interface AnalyticsResponse {
  range: {
    dateFrom: string;
    dateTo: string;
    days: number;
    granularity: "day" | "week" | "month";
    prevFrom: string;
    prevTo: string;
  };
  kpis: { current: Totals; previous: Totals };
  series: { bucket: string; revenue: number; tileSqm: number; transactions: number }[];
  topProducts: {
    id: string;
    productId: string;
    name: string;
    brand: string;
    unit: Unit;
    quantity: number;
    revenue: number;
    transactions: number;
  }[];
  byBrand: { name: string; tileSqm: number; revenue: number }[];
  bySize: { name: string; tileSqm: number; revenue: number }[];
  sellers: { id: string; name: string; transactions: number; tileSqm: number; revenue: number }[];
  stockHealth: {
    sellThrough: number;
    stockedProducts: number;
    slowMoverCount: number;
    runningOut: HealthItem[];
    slowMovers: HealthItem[];
  };
}

// ── Date range presets ─────────────────────────────────────────────────

const PRESETS = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "12m", label: "12M", days: 365 },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"] | "custom";

function toDayString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function presetRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from, to };
}

function formatBucket(bucket: string, granularity: AnalyticsResponse["range"]["granularity"]) {
  if (granularity === "month") {
    return new Date(`${bucket}-01T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  }
  return new Date(`${bucket}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCompact(value: number) {
  return value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
}

const TOOLTIP_STYLE = {
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px -8px rgba(0,0,0,0.2)",
};

const CARD_CLASS = "shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

// ── Building blocks ────────────────────────────────────────────────────

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

/** Percent change vs the previous period, coloured by direction. */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {current === 0 ? "No change" : "New this period"}
      </span>
    );
  }
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        rounded > 0 && "text-success",
        rounded < 0 && "text-destructive",
        rounded === 0 && "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {Math.abs(rounded)}%
    </span>
  );
}

function KpiCard({
  label,
  icon: Icon,
  iconClass,
  value,
  current,
  previous,
  note,
}: {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  value: React.ReactNode;
  current: number;
  previous: number;
  note?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-2xl border bg-card px-4 py-3.5", CARD_CLASS)}>
      <div className="flex h-8 items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", iconClass)}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-0.5 text-2xl font-semibold leading-tight tracking-tight tabular-nums">{value}</div>
      <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-1.5">
        <Delta current={current} previous={previous} />
        <span className="text-xs text-muted-foreground">vs previous period</span>
        {note && <span className="w-full text-xs text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

/** Label + horizontal share bar + value row, used by the breakdown lists. */
function ShareRow({
  label,
  sublabel,
  value,
  pct,
}: {
  label: string;
  sublabel?: string;
  value: string;
  pct: number;
}) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium" title={label}>
          {label}
          {sublabel && <span className="ml-1.5 font-normal text-muted-foreground">{sublabel}</span>}
        </span>
        <span className="shrink-0 text-sm font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary/80"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </li>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            value === o.key
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function HealthList({
  items,
  render,
  empty,
}: {
  items: HealthItem[];
  render: (item: HealthItem) => React.ReactNode;
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.productId}</p>
            <p className="truncate text-xs text-muted-foreground">
              {item.name} · {item.brand}
            </p>
          </div>
          <div className="shrink-0 text-right">{render(item)}</div>
        </li>
      ))}
    </ul>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
      <div className="grid gap-3 lg:grid-cols-12">
        <Skeleton className="h-96 rounded-2xl lg:col-span-7" />
        <Skeleton className="h-96 rounded-2xl lg:col-span-5" />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [trendMetric, setTrendMetric] = useState<"revenue" | "tileSqm">("revenue");
  const [breakdown, setBreakdown] = useState<"brand" | "size">("brand");

  const range =
    preset === "custom" && customRange.from
      ? { from: customRange.from, to: customRange.to ?? customRange.from }
      : presetRange(PRESETS.find((p) => p.key === preset)?.days ?? 30);
  const dateFrom = toDayString(range.from);
  const dateTo = toDayString(range.to);

  const { data, isLoading, isError, error, isFetching } = useQuery<AnalyticsResponse>({
    queryKey: ["analytics", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load analytics");
      return body;
    },
    placeholderData: keepPreviousData,
  });

  const current = data?.kpis.current;
  const previous = data?.kpis.previous;
  const avgSale = (t?: Totals) => (t && t.transactions > 0 ? t.revenue / t.transactions : 0);
  const hasSales = (current?.transactions ?? 0) > 0;

  const breakdownRows = breakdown === "brand" ? data?.byBrand ?? [] : data?.bySize ?? [];
  const breakdownMax = Math.max(
    ...breakdownRows.map((r) => (breakdown === "brand" ? r.revenue : r.tileSqm)),
    1,
  );
  const sellerRevenueTotal = (data?.sellers ?? []).reduce((a, s) => a + s.revenue, 0);
  const topProductMax = Math.max(...(data?.topProducts ?? []).map((p) => p.revenue), 1);

  return (
    <div className="flex h-full flex-col animate-in fade-in duration-500">
      <div className="flex-1 min-h-0 -m-4 p-4 overflow-y-auto overflow-x-hidden space-y-5 no-scrollbar">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Sales performance, top sellers and stock health for the selected period.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Date range"
              value={preset === "custom" ? ("" as PresetKey) : preset}
              options={PRESETS.map((p) => ({ key: p.key as PresetKey, label: p.label }))}
              onChange={(key) => {
                setPreset(key);
                setCustomRange({});
              }}
            />
            <DateRangePicker
              from={preset === "custom" ? customRange.from : undefined}
              to={preset === "custom" ? customRange.to : undefined}
              placeholder="Custom range"
              onChange={({ from, to }) => {
                if (from) {
                  setCustomRange({ from, to });
                  setPreset("custom");
                } else {
                  setCustomRange({});
                  setPreset("30d");
                }
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <AnalyticsSkeleton />
        ) : isError || !data || !current || !previous ? (
          <EmptyState
            icon={BarChart3}
            variant="warning"
            title="Couldn't load analytics"
            description={(error as Error | null)?.message ?? "Please try again."}
          />
        ) : (
          <div className={cn("space-y-5 transition-opacity", isFetching && "opacity-60")}>
            {/* KPIs */}
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Revenue"
                icon={Banknote}
                iconClass="bg-primary/10 text-primary"
                value={formatETB(current.revenue)}
                current={current.revenue}
                previous={previous.revenue}
              />
              <KpiCard
                label="Tiles sold"
                icon={Layers}
                iconClass="bg-success/10 text-success"
                value={`${formatNumber(current.tileSqm)} m²`}
                current={current.tileSqm}
                previous={previous.tileSqm}
                note={
                  current.skirtingM > 0 || current.pieces > 0
                    ? [
                        current.skirtingM > 0 && `+ ${formatNumber(current.skirtingM)} m skirting`,
                        current.pieces > 0 && `${formatNumber(current.pieces, 0)} pcs`,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : undefined
                }
              />
              <KpiCard
                label="Transactions"
                icon={Receipt}
                iconClass="bg-info/10 text-info"
                value={current.transactions.toLocaleString("en-US")}
                current={current.transactions}
                previous={previous.transactions}
              />
              <KpiCard
                label="Avg. sale value"
                icon={Calculator}
                iconClass="bg-muted text-muted-foreground"
                value={formatETB(avgSale(current))}
                current={avgSale(current)}
                previous={avgSale(previous)}
              />
            </section>

            {/* Sales over time */}
            <section className="space-y-3">
              <SectionHeader
                eyebrow="Sales"
                title="Sales over time"
                description={`Per ${data.range.granularity} · ${data.range.days} days`}
              />
              <Card className={CARD_CLASS}>
                <CardHeader>
                  <CardTitle>{trendMetric === "revenue" ? "Revenue (ETB)" : "Tiles sold (m²)"}</CardTitle>
                  <CardDescription>
                    {trendMetric === "revenue"
                      ? `${formatETB(current.revenue)} total`
                      : `${formatNumber(current.tileSqm)} m² total`}
                  </CardDescription>
                  <CardAction>
                    <Segmented
                      label="Chart metric"
                      value={trendMetric}
                      options={[
                        { key: "revenue", label: "Revenue" },
                        { key: "tileSqm", label: "m²" },
                      ]}
                      onChange={setTrendMetric}
                    />
                  </CardAction>
                </CardHeader>
                <CardContent className="h-80 pl-2">
                  {hasSales ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.series}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis
                          dataKey="bucket"
                          tickFormatter={(b) => formatBucket(b, data.range.granularity)}
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={16}
                          tick={{ fill: "var(--muted-foreground)" }}
                        />
                        <YAxis
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          width={48}
                          tickFormatter={formatCompact}
                          tick={{ fill: "var(--muted-foreground)" }}
                        />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                          labelFormatter={(b) => formatBucket(String(b), data.range.granularity)}
                          formatter={(v) =>
                            trendMetric === "revenue"
                              ? [formatETB(Number(v)), "Revenue"]
                              : [`${formatNumber(Number(v))} m²`, "Tiles sold"]
                          }
                        />
                        <Bar
                          dataKey={trendMetric}
                          fill="var(--chart-1)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No sales in this period.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Top sellers */}
            <section className="space-y-3">
              <SectionHeader
                eyebrow="Products"
                title="Top sellers"
                description="Ranked by revenue for the selected period."
              />
              <div className="grid gap-3 lg:grid-cols-12">
                <Card className={cn("lg:col-span-7", CARD_CLASS)}>
                  <CardHeader>
                    <CardTitle>Top products</CardTitle>
                    <CardDescription>Best 10 by revenue</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.topProducts.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No sales in this period.
                      </p>
                    ) : (
                      <ol className="space-y-3">
                        {data.topProducts.map((p, i) => (
                          <li key={p.id} className="flex items-center gap-3">
                            <span className="w-5 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="min-w-0 truncate text-sm font-medium" title={p.name}>
                                  {p.productId}
                                  <span className="ml-1.5 font-normal text-muted-foreground">
                                    {p.brand}
                                  </span>
                                </span>
                                <span className="shrink-0 text-sm font-medium tabular-nums">
                                  {formatETB(p.revenue)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                  <div
                                    className="h-full rounded-full bg-primary/80"
                                    style={{ width: `${(p.revenue / topProductMax) * 100}%` }}
                                  />
                                </div>
                                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                  {formatNumber(p.quantity)} {p.unit}
                                </span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </CardContent>
                </Card>

                <Card className={cn("lg:col-span-5", CARD_CLASS)}>
                  <CardHeader>
                    <CardTitle>{breakdown === "brand" ? "By brand" : "By tile size"}</CardTitle>
                    <CardDescription>
                      {breakdown === "brand" ? "Revenue per brand" : "Tile m² sold per size"}
                    </CardDescription>
                    <CardAction>
                      <Segmented
                        label="Breakdown"
                        value={breakdown}
                        options={[
                          { key: "brand", label: "Brand" },
                          { key: "size", label: "Size" },
                        ]}
                        onChange={setBreakdown}
                      />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    {breakdownRows.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No sales in this period.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {breakdownRows.map((r) => (
                          <ShareRow
                            key={r.name}
                            label={r.name}
                            sublabel={
                              breakdown === "brand"
                                ? `${formatNumber(r.tileSqm, 0)} m²`
                                : formatETB(r.revenue)
                            }
                            value={
                              breakdown === "brand"
                                ? formatETB(r.revenue)
                                : `${formatNumber(r.tileSqm)} m²`
                            }
                            pct={
                              ((breakdown === "brand" ? r.revenue : r.tileSqm) / breakdownMax) * 100
                            }
                          />
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Seller performance */}
            <section className="space-y-3">
              <SectionHeader
                eyebrow="Team"
                title="Seller performance"
                description="Who recorded the sales in this period."
              />
              <Card className={CARD_CLASS}>
                <CardContent>
                  {data.sellers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No sales in this period.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[32rem] text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="pb-2 font-medium">Seller</th>
                            <th className="pb-2 text-right font-medium">Sales</th>
                            <th className="pb-2 text-right font-medium">Tiles (m²)</th>
                            <th className="pb-2 text-right font-medium">Revenue</th>
                            <th className="w-40 pb-2 pl-4 font-medium">Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {data.sellers.map((s) => {
                            const share = sellerRevenueTotal > 0 ? (s.revenue / sellerRevenueTotal) * 100 : 0;
                            return (
                              <tr key={s.id}>
                                <td className="py-2.5 font-medium">
                                  <span className={cn(s.id === "unassigned" && "text-muted-foreground")}>
                                    {s.name}
                                  </span>
                                </td>
                                <td className="py-2.5 text-right tabular-nums">{s.transactions}</td>
                                <td className="py-2.5 text-right tabular-nums">{formatNumber(s.tileSqm)}</td>
                                <td className="py-2.5 text-right font-medium tabular-nums">{formatETB(s.revenue)}</td>
                                <td className="py-2.5 pl-4">
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                      <div className="h-full rounded-full bg-primary/80" style={{ width: `${share}%` }} />
                                    </div>
                                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                                      {Math.round(share)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Stock health */}
            <section className="space-y-3">
              <SectionHeader
                eyebrow="Inventory"
                title="Stock health"
                description="How fast stock is moving at the selected period's sales pace."
              />
              <div className="grid gap-3 md:grid-cols-2">
                <div className={cn("rounded-2xl border bg-card p-4", CARD_CLASS)}>
                  <p className="text-sm font-medium text-muted-foreground">Tile sell-through</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {Math.round(data.stockHealth.sellThrough * 100)}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Share of available tile stock sold during the period
                  </p>
                </div>
                <div className={cn("rounded-2xl border bg-card p-4", CARD_CLASS)}>
                  <p className="text-sm font-medium text-muted-foreground">Slow movers</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {data.stockHealth.slowMoverCount}
                    <span className="ml-1.5 text-base font-medium text-muted-foreground">
                      of {data.stockHealth.stockedProducts}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    In-stock products with no sales during the period
                  </p>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <Card className={CARD_CLASS}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hourglass className="size-4 text-warning-foreground dark:text-warning" />
                      Running out soonest
                    </CardTitle>
                    <CardDescription>Days of stock left at the current sales pace</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HealthList
                      items={data.stockHealth.runningOut}
                      empty="No products sold in this period."
                      render={(item) => (
                        <>
                          <p
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              item.daysOfCover! < 14 && "text-destructive",
                            )}
                          >
                            {item.daysOfCover! < 1 ? "< 1" : Math.round(item.daysOfCover!)} days
                          </p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {formatNumber(item.currentStock)} {item.unit} left
                          </p>
                        </>
                      )}
                    />
                  </CardContent>
                </Card>
                <Card className={CARD_CLASS}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Snail className="size-4 text-muted-foreground" />
                      Slow movers
                    </CardTitle>
                    <CardDescription>Most stock tied up with no sales in this period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HealthList
                      items={data.stockHealth.slowMovers}
                      empty="Every in-stock product sold at least once."
                      render={(item) => (
                        <p className="text-sm font-semibold tabular-nums">
                          {formatNumber(item.currentStock)} {item.unit}
                        </p>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
