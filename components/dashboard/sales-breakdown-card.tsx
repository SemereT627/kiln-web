"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn, formatBirr, formatNumber } from "@/lib/utils";
import {
  ChangeBadge,
  DashCard,
  HatchedBar,
  MoreMenu,
  PillLink,
  TickLabel,
  pctChange,
} from "@/components/dashboard/chart-card";
import { buildBuckets, type Bucket, type Period, type SalesDay } from "@/components/dashboard/sales-data";

export const BREAKDOWN_COLORS = ["var(--primary)", "var(--ink)", "var(--muted-foreground)"];

const PERIODS: Period[] = ["daily", "weekly", "monthly", "annually"];

function SalesTooltip({
  active,
  payload,
  buckets,
  showRevenue,
  t,
}: {
  active?: boolean;
  payload?: { payload: Bucket }[];
  buckets: Bucket[];
  showRevenue: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const b = payload?.[0]?.payload;
  if (!active || !b) return null;
  const i = buckets.findIndex((x) => x.key === b.key);
  const change = i > 0 ? pctChange(b.sqm, buckets[i - 1].sqm) : null;
  return (
    <div className="w-52 rounded-xl bg-ink p-3 text-ink-foreground shadow-lg">
      <p className="text-[11px] opacity-80">{b.fullLabel}</p>
      <div className="mt-1.5 flex items-end gap-2">
        <span className="text-2xl font-medium leading-none tabular-nums">
          {formatNumber(b.sqm, 0)}
        </span>
        <span className="text-[11px] leading-tight opacity-60">{t("tooltipUnit")}</span>
        <span className="ml-auto">
          <ChangeBadge value={change} />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-[1px] bg-primary" />
          {t("tooltipTx", { count: b.tx })}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-[1px] bg-ink-foreground" />
          {formatNumber(b.linear, 0)} m
        </span>
        {showRevenue && (
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-[1px] bg-ink-foreground/50" />
            {formatBirr(b.revenue)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The big panel: all-time tile sales and the top 3 brands on the left, the
 * sales trend for the chosen period on the right.
 */
export function SalesBreakdownCard({
  totalSold,
  topBrands,
  days,
  today,
  isAdmin,
  className,
}: {
  totalSold: number;
  topBrands: { name: string; sold: number }[];
  days: SalesDay[];
  today: string;
  isAdmin: boolean;
  className?: string;
}) {
  const t = useTranslations("Dashboard.breakdown");
  const [period, setPeriod] = useState<Period>("monthly");
  const buckets = buildBuckets(days, period, today);
  const totals = buckets.reduce(
    (a, b) => ({ sqm: a.sqm + b.sqm, linear: a.linear + b.linear, tx: a.tx + b.tx }),
    { sqm: 0, linear: 0, tx: 0 },
  );

  return (
    <DashCard
      className={className}
      icon={BarChart3}
      title={t("title")}
      action={
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label={t("periodAria")} className="flex rounded-full bg-muted p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-4 sm:text-sm",
                  period === p
                    ? "bg-ink text-ink-foreground"
                    : "text-foreground hover:bg-background/60",
                )}
              >
                {t(p)}
              </button>
            ))}
          </div>
          <MoreMenu
            label={t("more")}
            items={[
              { label: t("salesLog"), href: "/sales/log" },
              ...(isAdmin ? [{ label: t("analytics"), href: "/analytics" }] : []),
            ]}
          />
        </div>
      }
      contentClassName="grid gap-5 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
    >
      {/* Left: all-time total and the three best-selling brands */}
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <span className="text-[40px] font-semibold leading-none tracking-tight tabular-nums">
            {formatNumber(totalSold, 0)}
          </span>
          <Link
            href="/sales/log"
            aria-label={t("details")}
            className="flex size-5 items-center justify-center rounded-full border border-foreground/70 text-foreground"
          >
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-b pb-4">
          <span className="text-xs text-muted-foreground">{t("totalLabel")}</span>
          <PillLink href="/sales/log">{t("details")}</PillLink>
        </div>
        {topBrands.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">{t("noBrandSales")}</p>
        ) : (
          <ul className="divide-y divide-dashed">
            {topBrands.map((b, i) => {
              const pct = totalSold > 0 ? (b.sold / totalSold) * 100 : 0;
              return (
                <li key={b.name} className="py-3.5">
                  <TickLabel color={BREAKDOWN_COLORS[i]}>{b.name}</TickLabel>
                  <HatchedBar className="mt-2.5" pct={pct} color={BREAKDOWN_COLORS[i]} />
                  <p className="mt-2 text-xs tabular-nums">
                    <span className="font-semibold">
                      {formatNumber(pct, 1)}% · {formatNumber(b.sold, 0)}
                    </span>{" "}
                    <span className="text-muted-foreground">m²</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Right: trend for the chosen period, footer with period totals */}
      <div className="flex min-h-80 min-w-0 flex-col rounded-2xl border">
        <div className="min-h-0 flex-1 px-1 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={buckets} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
              <defs>
                <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                interval="preserveStartEnd"
                minTickGap={8}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip
                cursor={{ stroke: "var(--primary)", strokeDasharray: "3 3" }}
                content={(props) => (
                  <SalesTooltip
                    active={props.active}
                    payload={props.payload as unknown as { payload: Bucket }[]}
                    buckets={buckets}
                    showRevenue={isAdmin}
                    t={t}
                  />
                )}
              />
              <Area
                type="linear"
                dataKey="sqm"
                stroke="var(--primary)"
                strokeWidth={1.5}
                fill="url(#sales-fill)"
                isAnimationActive={false}
                activeDot={{ r: 5, fill: "var(--ink)", stroke: "var(--card)", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 divide-x border-t">
          {[
            { label: t("tiles"), value: `${formatNumber(totals.sqm, 0)}`, unit: "m²" },
            { label: t("skirting"), value: `${formatNumber(totals.linear, 0)}`, unit: "m" },
            { label: t("transactions"), value: formatNumber(totals.tx, 0), unit: "" },
          ].map((f, i) => (
            <div key={f.label} className="min-w-0 px-4 py-3">
              <TickLabel color={BREAKDOWN_COLORS[i]}>{f.label}</TickLabel>
              <p className="mt-1.5 truncate text-[15px] font-semibold tabular-nums">
                {f.value}{" "}
                <span className="text-xs font-normal text-muted-foreground">{f.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </DashCard>
  );
}
