"use client";

import { useTranslations } from "next-intl";
import { Gauge, PackageCheck, PackageMinus, PackageX, type LucideIcon } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import { cn, formatNumber } from "@/lib/utils";
import { DashCard } from "@/components/dashboard/chart-card";

// Solid base colour with faint diagonal stripes, like the reference gauge.
function Stripes({ id, color, stripe }: { id: string; color: string; stripe: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" style={{ fill: color }} />
      <rect width="1.5" height="6" style={{ fill: stripe }} />
    </pattern>
  );
}

/**
 * Half-ring gauge of products by stock status (in stock / low / out), with
 * the three counts underneath. Low and Out open the attention list.
 */
export function StockGaugeCard({
  inStock,
  low,
  out,
  onOpenList,
}: {
  inStock: number;
  low: number;
  out: number;
  onOpenList: () => void;
}) {
  const t = useTranslations("Dashboard.stockHealth");
  const total = inStock + low + out;
  const slices = [
    { key: "in", value: inStock, fill: "url(#gauge-in)" },
    { key: "low", value: low, fill: "url(#gauge-low)" },
    { key: "out", value: out, fill: "url(#gauge-out)" },
  ].filter((s) => s.value > 0);

  const stats: {
    key: string;
    icon: LucideIcon;
    label: string;
    value: number;
    bar: string;
    onClick?: () => void;
  }[] = [
    { key: "in", icon: PackageCheck, label: t("inStock"), value: inStock, bar: "bg-primary" },
    { key: "low", icon: PackageMinus, label: t("low"), value: low, bar: "bg-ink", onClick: low > 0 ? onOpenList : undefined },
    { key: "out", icon: PackageX, label: t("out"), value: out, bar: "bg-muted-foreground", onClick: out > 0 ? onOpenList : undefined },
  ];

  return (
    <DashCard icon={Gauge} title={t("title")} contentClassName="-mx-5 -mb-5 mt-5">
      <div
        role="img"
        aria-label={`${t("total")}: ${total}. ${t("inStock")} ${inStock}, ${t("low")} ${low}, ${t("out")} ${out}`}
        className="relative mx-auto h-[114px] w-[224px]"
      >
        {/* Fixed size: the label sits inside the ring's hole, so the radii
            must leave room for it rather than scale with the card. */}
        <PieChart width={224} height={114} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <Stripes id="gauge-in" color="var(--primary)" stripe="color-mix(in oklch, var(--primary) 80%, white)" />
              <Stripes id="gauge-low" color="var(--ink)" stripe="color-mix(in oklch, var(--ink) 80%, white)" />
              <Stripes id="gauge-out" color="color-mix(in oklch, var(--muted-foreground) 55%, var(--card))" stripe="color-mix(in oklch, var(--muted-foreground) 80%, var(--card))" />
            </defs>
            <Pie
              data={slices.length ? slices : [{ key: "none", value: 1, fill: "var(--muted)" }]}
              dataKey="value"
              cx={112}
              cy={110}
              startAngle={180}
              endAngle={0}
              innerRadius={78}
              outerRadius={108}
              paddingAngle={slices.length > 1 ? 1.5 : 0}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
            >
              {(slices.length ? slices : [{ key: "none", fill: "var(--muted)" }]).map((s) => (
                <Cell key={s.key} fill={s.fill} />
              ))}
            </Pie>
        </PieChart>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
          <p className="text-[26px] font-semibold leading-none tabular-nums">
            {formatNumber(total, 0)}
          </p>
          <p className="mt-1 text-xs font-medium">{t("total")}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 divide-x border-t">
        {stats.map((s) => {
          const Body = (
            <>
              <s.icon className="size-6 text-muted-foreground" strokeWidth={1.5} />
              <span className="mt-2 text-sm">{s.label}</span>
              <span className="text-sm font-semibold tabular-nums">{formatNumber(s.value, 0)}</span>
              <span aria-hidden="true" className={cn("mt-2 h-0.5 w-4 rounded-full", s.bar)} />
            </>
          );
          const cls = "flex flex-col items-center pt-4 pb-3";
          return s.onClick ? (
            <button
              key={s.key}
              type="button"
              onClick={s.onClick}
              className={cn(cls, "outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50")}
            >
              {Body}
            </button>
          ) : (
            <div key={s.key} className={cls}>
              {Body}
            </div>
          );
        })}
      </div>
    </DashCard>
  );
}
