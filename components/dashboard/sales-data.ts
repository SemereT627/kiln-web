"use client";

import { useQuery } from "@tanstack/react-query";

/** One day from /api/sales/summary (Addis Ababa calendar day). */
export interface SalesDay {
  date: string;
  transactionCount: number;
  totalSqm: number;
  totalLinear: number;
  grossTotal: number | null;
}

export type Period = "daily" | "weekly" | "monthly" | "annually";

export interface Bucket {
  key: string;
  label: string;
  fullLabel: string;
  sqm: number;
  linear: number;
  tx: number;
  revenue: number;
}

// Dates are plain "YYYY-MM-DD" strings; arithmetic runs in UTC so DST and the
// browser's zone never shift a day.
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(s: string, n: number) {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

function mondayOf(s: string) {
  return addDays(s, -((toDate(s).getUTCDay() + 6) % 7));
}

/** Today in Addis Ababa, where sales days are counted. */
export function addisToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa" }).format(new Date());
}

const fmt = (s: string, opts: Intl.DateTimeFormatOptions) =>
  toDate(s).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

/**
 * Daily sales since 1 Jan four years back — enough for every chart period.
 * Sellers get only their own sales (RLS on the sales table).
 */
export function useSalesDays() {
  const today = addisToday();
  const from = `${Number(today.slice(0, 4)) - 4}-01-01`;
  return useQuery({
    queryKey: ["sales", "summary", "dashboard", from, today],
    queryFn: async () => {
      const res = await fetch(
        `/api/sales/summary?dateFrom=${from}&dateTo=${today}&limit=2000`,
      );
      if (!res.ok) throw new Error("Failed to fetch sales summary");
      const json = await res.json();
      return { today, from, days: (json.data ?? []) as SalesDay[] };
    },
  });
}

/** Sums the days in [start, end] (inclusive). */
export function sumRange(days: SalesDay[], start: string, end: string) {
  const out = { sqm: 0, linear: 0, tx: 0, revenue: 0 };
  for (const d of days) {
    if (d.date < start || d.date > end) continue;
    out.sqm += d.totalSqm;
    out.linear += d.totalLinear;
    out.tx += d.transactionCount;
    out.revenue += d.grossTotal ?? 0;
  }
  return out;
}

/** Zero-filled buckets for a chart period, oldest first, ending today. */
export function buildBuckets(days: SalesDay[], period: Period, today: string): Bucket[] {
  const keys: string[] = [];
  if (period === "daily") {
    for (let i = 29; i >= 0; i--) keys.push(addDays(today, -i));
  } else if (period === "weekly") {
    const monday = mondayOf(today);
    for (let i = 11; i >= 0; i--) keys.push(addDays(monday, -7 * i));
  } else if (period === "monthly") {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7)) - 1;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - i, 1));
      keys.push(iso(d).slice(0, 7));
    }
  } else {
    const y = Number(today.slice(0, 4));
    for (let i = 4; i >= 0; i--) keys.push(String(y - i));
  }

  const keyOf = (date: string) =>
    period === "daily"
      ? date
      : period === "weekly"
        ? mondayOf(date)
        : period === "monthly"
          ? date.slice(0, 7)
          : date.slice(0, 4);

  const map = new Map(keys.map((k) => [k, { sqm: 0, linear: 0, tx: 0, revenue: 0 }]));
  for (const d of days) {
    const b = map.get(keyOf(d.date));
    if (!b) continue;
    b.sqm += d.totalSqm;
    b.linear += d.totalLinear;
    b.tx += d.transactionCount;
    b.revenue += d.grossTotal ?? 0;
  }

  return keys.map((key) => {
    const v = map.get(key)!;
    let label: string;
    let fullLabel: string;
    if (period === "daily" || period === "weekly") {
      label = fmt(key, { day: "numeric", month: "short" });
      fullLabel = fmt(key, { day: "numeric", month: "long", year: "numeric" });
    } else if (period === "monthly") {
      label = fmt(`${key}-01`, { month: "short" }).toUpperCase();
      fullLabel = fmt(`${key}-01`, { month: "long", year: "numeric" });
    } else {
      label = key;
      fullLabel = key;
    }
    return { key, label, fullLabel, ...v };
  });
}
