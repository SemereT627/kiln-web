"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatNumber } from "@/lib/utils";

export interface StockTypeRow {
  typeId: string;
  brand: string;
  size: string;
  finish: string;
  measurementUnit: string;
  initialStock: number;
  soldStock: number;
  currentStock: number;
}

type Metric = "stock" | "sold";

// Validated categorical slots (globals.css --series-*). Finishes take them in
// a fixed alphabetical order so a finish keeps its colour across brand tabs;
// anything past the fifth folds into "Other".
const SERIES = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5"];
const OTHER = "__other__";
const OTHER_COLOR = "color-mix(in oklch, var(--muted-foreground) 55%, transparent)";

const ALL = "__all__";

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
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1 no-scrollbar"
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function StockBreakdownDialog({
  open,
  onOpenChange,
  rows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: StockTypeRow[];
}) {
  const t = useTranslations("Inventory.stockBreakdown");
  const [brand, setBrand] = useState<string>(ALL);
  const [metric, setMetric] = useState<Metric>("stock");

  const brands = useMemo(
    () => [...new Set(rows.map((r) => r.brand))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  // Colour assignment from the full set, not the filtered one, so switching
  // brand never repaints a finish.
  const finishColor = useMemo(() => {
    const names = [
      ...new Set(rows.filter((r) => r.measurementUnit === "m²").map((r) => r.finish)),
    ].sort((a, b) => a.localeCompare(b));
    const map = new Map<string, string>();
    names.forEach((n, i) =>
      map.set(n, i < SERIES.length ? `var(${SERIES[i]})` : OTHER_COLOR),
    );
    return map;
  }, [rows]);
  const seriesKey = (finish: string) =>
    finishColor.get(finish) === OTHER_COLOR ? OTHER : finish;

  const scoped = brand === ALL ? rows : rows.filter((r) => r.brand === brand);
  const tiles = scoped.filter((r) => r.measurementUnit === "m²");
  const skirtingM = scoped
    .filter((r) => r.measurementUnit === "m")
    .reduce((s, r) => s + r.currentStock, 0);
  const pieces = scoped
    .filter((r) => r.measurementUnit === "pcs")
    .reduce((s, r) => s + r.currentStock, 0);

  // Table: size -> finish rows (finishes merged across brands on "All").
  const sizeGroups = useMemo(() => {
    const bySize = new Map<string, Map<string, StockTypeRow>>();
    for (const r of tiles) {
      const finishes = bySize.get(r.size) ?? new Map<string, StockTypeRow>();
      const prev = finishes.get(r.finish);
      finishes.set(
        r.finish,
        prev
          ? {
              ...prev,
              initialStock: prev.initialStock + r.initialStock,
              soldStock: prev.soldStock + r.soldStock,
              currentStock: prev.currentStock + r.currentStock,
            }
          : { ...r },
      );
      bySize.set(r.size, finishes);
    }
    return [...bySize.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([size, finishes]) => {
        const items = [...finishes.values()].sort((a, b) => b.currentStock - a.currentStock);
        return {
          size,
          items,
          stock: items.reduce((s, r) => s + r.currentStock, 0),
          sold: items.reduce((s, r) => s + r.soldStock, 0),
          received: items.reduce((s, r) => s + r.initialStock, 0),
        };
      });
  }, [tiles]);

  const tileStock = sizeGroups.reduce((s, g) => s + g.stock, 0);

  // Chart: one row per size, one stacked segment per finish.
  const legendKeys = [
    ...new Set(
      [...finishColor.keys()]
        .filter((f) => tiles.some((r) => r.finish === f))
        .map(seriesKey),
    ),
  ];
  const chartData = sizeGroups.map((g) => {
    const row: Record<string, number | string> = { size: g.size };
    for (const k of legendKeys) row[k] = 0;
    for (const item of g.items) {
      const k = seriesKey(item.finish);
      row[k] = (row[k] as number) + (metric === "stock" ? item.currentStock : item.soldStock);
    }
    row.__total = metric === "stock" ? g.stock : g.sold;
    return row;
  });
  const colorFor = (k: string) => (k === OTHER ? OTHER_COLOR : finishColor.get(k)!);
  const labelFor = (k: string) => (k === OTHER ? t("other") : k);

  const pct = (sold: number, received: number) =>
    received > 0 ? `${Math.round((sold / received) * 100)}%` : "—";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setBrand(ALL);
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-5 pt-5 pb-4">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="tabular-nums">
            {formatNumber(tileStock)} m² {t("tiles")}
            {skirtingM > 0 && <> · {formatNumber(skirtingM)} m {t("skirting")}</>}
            {pieces > 0 && <> · {formatNumber(pieces, 0)} pcs</>}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Filters — one row above the chart */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              label={t("brandFilter")}
              value={brand}
              onChange={setBrand}
              options={[
                { key: ALL, label: t("allBrands") },
                ...brands.map((b) => ({ key: b, label: b })),
              ]}
            />
            <Segmented
              label={t("metricFilter")}
              value={metric}
              onChange={setMetric}
              options={[
                { key: "stock", label: t("metricStock") },
                { key: "sold", label: t("metricSold") },
              ]}
            />
          </div>

          {sizeGroups.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("noData")}</p>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <h3 className="text-sm font-semibold">
                    {metric === "stock" ? t("chartStock") : t("chartSold")}
                  </h3>
                  {legendKeys.length > 1 && (
                    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                      {legendKeys.map((k) => (
                        <li key={k} className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="size-2.5 rounded-[3px]"
                            style={{ background: colorFor(k) }}
                          />
                          {labelFor(k)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ height: Math.max(160, chartData.length * 52 + 40) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                      barCategoryGap={12}
                    >
                      <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatNumber(v, 0)}
                        tick={{ fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="size"
                        width={56}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "var(--foreground)" }}
                      />
                      {/* Row totals as a right-hand label column — a category
                          axis carrying text, not a second value scale. */}
                      <YAxis
                        yAxisId="totals"
                        orientation="right"
                        type="category"
                        dataKey="size"
                        width={96}
                        tickLine={false}
                        axisLine={false}
                        // Custom tick: Recharts wraps default tick text to the
                        // axis width, splitting "1,313.68 m²" over two lines.
                        tick={({ x, y, payload }) => (
                          <text
                            x={x}
                            y={y}
                            dx={8}
                            dy={4}
                            fontSize={12}
                            fontWeight={600}
                            fill="var(--foreground)"
                            className="tabular-nums"
                          >
                            {formatNumber(
                              Number(chartData.find((d) => d.size === payload.value)?.__total ?? 0),
                            )}{" "}
                            m²
                          </text>
                        )}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                        contentStyle={{
                          borderRadius: "10px",
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                          boxShadow: "0 8px 24px -8px rgba(0,0,0,0.2)",
                          fontSize: 12,
                        }}
                        formatter={(v, name) =>
                          name === "__total" || Number(v) === 0
                            ? [null, null]
                            : [`${formatNumber(Number(v))} m²`, labelFor(String(name))]
                        }
                      />
                      {legendKeys.map((k) => (
                        <Bar
                          key={k}
                          dataKey={k}
                          name={k}
                          stackId="s"
                          fill={colorFor(k)}
                          stroke="var(--background)"
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[34rem] text-sm tabular-nums">
                  <thead>
                    <tr className="border-b bg-muted/30 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      <th className="px-3 py-2 text-left font-medium">{t("colSize")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("colFinish")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("colStock")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("colSold")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("colReceived")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("colSoldPct")}</th>
                    </tr>
                  </thead>
                  {sizeGroups.map((g) => (
                    <tbody key={g.size} className="border-b last:border-0">
                      {g.items.map((r, i) => (
                        <tr key={r.finish}>
                          <td className="px-3 py-2 font-medium">{i === 0 ? g.size : ""}</td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="size-2 shrink-0 rounded-[2px]"
                                style={{ background: colorFor(seriesKey(r.finish)) }}
                              />
                              {r.finish}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {formatNumber(r.currentStock)} m²
                          </td>
                          <td className="px-3 py-2 text-right">{formatNumber(r.soldStock)} m²</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {formatNumber(r.initialStock)} m²
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {pct(r.soldStock, r.initialStock)}
                          </td>
                        </tr>
                      ))}
                      {g.items.length > 1 && (
                        <tr className="bg-muted/20 text-muted-foreground">
                          <td className="px-3 py-1.5" />
                          <td className="px-3 py-1.5 text-xs">{t("subtotal")}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-foreground">
                            {formatNumber(g.stock)} m²
                          </td>
                          <td className="px-3 py-1.5 text-right">{formatNumber(g.sold)} m²</td>
                          <td className="px-3 py-1.5 text-right">{formatNumber(g.received)} m²</td>
                          <td className="px-3 py-1.5 text-right">{pct(g.sold, g.received)}</td>
                        </tr>
                      )}
                    </tbody>
                  ))}
                </table>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
