"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueries } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import {
  ChangeBadge,
  DashCard,
  PillLink,
  pctChange,
} from "@/components/dashboard/chart-card";
import { addDays, sumRange, type SalesDay } from "@/components/dashboard/sales-data";

const STATUSES = ["approved", "pending", "rejected"] as const;

/**
 * Order counts by status (sellers and admins only — viewers can't read
 * orders), then a 7-day sales window you can step back through.
 */
export function OrdersCard({
  showOrders,
  days,
  today,
  from,
  onRefresh,
  updatedAt,
  className,
}: {
  showOrders: boolean;
  days: SalesDay[];
  today: string;
  /** Earliest day fetched; stepping back stops there. */
  from: string;
  onRefresh: () => void;
  updatedAt?: number;
  className?: string;
}) {
  const t = useTranslations("Dashboard.orders");
  const [weeksBack, setWeeksBack] = useState(0);

  // Same keys and URL as the sidebar's pending badge, so they share cache.
  const counts = useQueries({
    queries: STATUSES.map((status) => ({
      queryKey: ["orders", status, { page: 1 }],
      queryFn: async () => {
        const res = await fetch(`/api/orders?status=${status}&limit=1`);
        if (!res.ok) throw new Error("Failed to fetch orders");
        return res.json() as Promise<{ total: number }>;
      },
      enabled: showOrders,
    })),
  });
  const rows = STATUSES.map((s, i) => ({ status: s, count: counts[i].data?.total ?? 0 }));
  const orderTotal = rows.reduce((a, r) => a + r.count, 0);

  const end = addDays(today, -7 * weeksBack);
  const start = addDays(end, -6);
  const cur = sumRange(days, start, end);
  const prev = sumRange(days, addDays(start, -7), addDays(start, -1));
  const canGoBack = addDays(start, -7) >= from;
  const maxCol = Math.max(cur.tx, cur.linear, 1);

  return (
    <DashCard
      className={className}
      icon={ReceiptText}
      title={t("title")}
      subtitle={t("subtitle")}
      updatedAt={updatedAt}
      action={
        <button
          type="button"
          onClick={() => {
            onRefresh();
            counts.forEach((c) => c.refetch());
          }}
          className="rounded text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {t("refresh")}
        </button>
      }
    >
      {showOrders && (
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="pb-2 text-left font-normal">{t("status")}</th>
              <th className="pb-2 text-right font-normal">{t("share")}</th>
              <th className="w-16 pb-2 text-right font-normal">{t("count")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.status} className="border-t border-dashed">
                <td className="py-3.5 font-medium">{t(r.status)}</td>
                <td className="py-3.5 text-right">
                  {orderTotal > 0 ? formatNumber((r.count / orderTotal) * 100, 1) : "0.0"}%
                </td>
                <td className="py-3.5 text-right">{formatNumber(r.count, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={showOrders ? "mt-1 border-t pt-4" : undefined}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {weeksBack === 0
              ? t("last7")
              : `${new Date(`${start}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })} – ${new Date(`${end}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })}`}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label={t("prevWeek")}
              disabled={!canGoBack}
              onClick={() => setWeeksBack((w) => w + 1)}
              className="flex size-6 items-center justify-center rounded-full bg-muted outline-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={t("nextWeek")}
              disabled={weeksBack === 0}
              onClick={() => setWeeksBack((w) => w - 1)}
              className="flex size-6 items-center justify-center rounded-full bg-ink text-ink-foreground outline-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-end gap-3">
          <div className="min-w-0">
            <p className="truncate text-2xl font-semibold leading-none tabular-nums">
              {formatNumber(cur.sqm, 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("tilesSold")}</p>
          </div>
          <div className="grid grid-cols-2 items-end gap-1.5">
            {[
              { value: cur.tx, prev: prev.tx, unit: t("transactions"), solid: false },
              { value: cur.linear, prev: prev.linear, unit: t("skirting"), solid: true },
            ].map((c) => (
              <div key={c.unit} className="min-w-0">
                <div className="border-l border-foreground/70 pl-1.5">
                  <p className="text-sm font-semibold leading-tight tabular-nums">
                    {formatNumber(c.value, 0)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{c.unit}</p>
                  <div className="mt-1 flex justify-end">
                    <ChangeBadge value={pctChange(c.value, c.prev)} />
                  </div>
                </div>
                <div
                  aria-hidden="true"
                  className={
                    c.solid
                      ? "bg-hatch mt-1 rounded-[4px] bg-ink text-ink-foreground/15"
                      : "bg-hatch mt-1 rounded-[4px] text-foreground/12"
                  }
                  style={{ height: `${12 + (c.value / maxCol) * 18}px` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <PillLink href="/sales/log">{t("details")}</PillLink>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="bg-hatch size-2 rounded-[2px] text-foreground/25" />
              {t("transactions")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-ink" />
              {t("skirting")}
            </span>
          </div>
        </div>
      </div>
    </DashCard>
  );
}
