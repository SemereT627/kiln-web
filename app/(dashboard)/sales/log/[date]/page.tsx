"use client";

import { Fragment, Suspense, use, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Layers,
  Receipt,
  Ruler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { formatEthiopian } from "@/lib/ethiopian-calendar";
import { cn, formatETB, formatNumber } from "@/lib/utils";

interface SaleRecord {
  id: string;
  quantity: number;
  priceAtSale: number | null;
  createdAt: string;
  productCode: string;
  brand: string;
  size: string;
  finish: string;
  measurementUnit: string;
  orderId: string | null;
  orderPaymentMethod: "cash" | "bank_transfer" | "credit" | null;
  sellerName: string | null;
}

/** One sale, or one approved order with its line items. */
interface Transaction {
  key: string;
  orderId: string | null;
  sellerName: string | null;
  paymentMethod: SaleRecord["orderPaymentMethod"];
  at: string;
  items: SaleRecord[];
  total: number;
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  credit: "Credit",
};

const TH =
  "sticky top-0 z-10 bg-card text-[11px] uppercase tracking-wider font-semibold text-muted-foreground";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Days are bucketed in Addis Ababa time by the API, so show times there too. */
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Addis_Ababa",
  });
}

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateParam(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDay(dateStr: string, days: number) {
  const d = parseDateOnly(dateStr);
  d.setDate(d.getDate() + days);
  return toDateParam(d);
}

const lineTotal = (s: SaleRecord) => s.quantity * (s.priceAtSale ?? 0);

function groupTransactions(sales: SaleRecord[]): Transaction[] {
  const out: Transaction[] = [];
  const byOrder = new Map<string, Transaction>();
  for (const s of sales) {
    if (!s.orderId) {
      out.push({
        key: s.id,
        orderId: null,
        sellerName: s.sellerName,
        paymentMethod: null,
        at: s.createdAt,
        items: [s],
        total: lineTotal(s),
      });
      continue;
    }
    let t = byOrder.get(s.orderId);
    if (!t) {
      t = {
        key: s.orderId,
        orderId: s.orderId,
        sellerName: s.sellerName,
        paymentMethod: s.orderPaymentMethod,
        at: s.createdAt,
        items: [],
        total: 0,
      };
      byOrder.set(s.orderId, t);
      out.push(t);
    }
    t.items.push(s);
    t.total += lineTotal(s);
    if (s.createdAt < t.at) t.at = s.createdAt;
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export default function SalesDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <SalesDay date={use(params).date} />
    </Suspense>
  );
}

function SalesDay({ date }: { date: string }) {
  const highlightOrderId = useSearchParams().get("order");
  const valid = DATE_RE.test(date) && !Number.isNaN(parseDateOnly(date).getTime());

  const { data: sales, isLoading, isError } = useQuery({
    queryKey: ["sales", "day", date],
    queryFn: async () => {
      const res = await fetch(`/api/sales?dateFrom=${date}&dateTo=${date}&limit=-1`);
      if (!res.ok) throw new Error("Failed to fetch sales for this day");
      const json = await res.json();
      return (json.data || []) as SaleRecord[];
    },
    enabled: valid,
  });

  const transactions = useMemo(() => groupTransactions(sales ?? []), [sales]);

  const summary = useMemo(() => {
    const all = sales ?? [];
    const sum = (unit: string) =>
      all.filter((s) => (s.measurementUnit || "m²") === unit).reduce((a, s) => a + s.quantity, 0);
    // Direct (POS) sales record no payment method; only orders carry one.
    const byPayment = new Map<string, number>();
    for (const t of transactions) {
      const k = t.paymentMethod ?? "direct";
      byPayment.set(k, (byPayment.get(k) ?? 0) + t.total);
    }
    return {
      revenue: transactions.reduce((a, t) => a + t.total, 0),
      sqm: sum("m²"),
      linear: sum("m"),
      byPayment: (["direct", "cash", "bank_transfer", "credit"] as const)
        .filter((k) => byPayment.has(k))
        .map((k) => ({
          key: k,
          label: k === "direct" ? "Direct sales" : `${PAYMENT_LABEL[k]} orders`,
          amount: byPayment.get(k)!,
        })),
    };
  }, [sales, transactions]);

  if (!valid) {
    return (
      <div className="flex h-full flex-col gap-4">
        <BackLink />
        <EmptyState icon={Receipt} title="Invalid date" description="Open a day from the Sales Log." />
      </div>
    );
  }

  const day = parseDateOnly(date);
  const isToday = date === toDateParam(new Date());

  return (
    <div className="flex h-full flex-col animate-in fade-in duration-500">
      <div className="flex-1 min-h-0 -m-4 p-4 overflow-y-auto overflow-x-hidden space-y-4 no-scrollbar">
        {/* Header with day navigation */}
        <div className="space-y-3">
          <BackLink />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {day.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{formatEthiopian(day)} E.C.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button asChild variant="outline" size="icon" aria-label="Previous day">
                <Link href={`/sales/log/${shiftDay(date, -1)}`}>
                  <ChevronLeft className="size-4" />
                </Link>
              </Button>
              {isToday ? (
                <Button variant="outline" size="icon" disabled aria-label="Next day">
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button asChild variant="outline" size="icon" aria-label="Next day">
                  <Link href={`/sales/log/${shiftDay(date, 1)}`}>
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <DaySkeleton />
        ) : isError ? (
          <EmptyState
            icon={Receipt}
            variant="warning"
            title="Couldn't load this day"
            description="Check your connection and try again."
          />
        ) : transactions.length === 0 ? (
          <EmptyState icon={Receipt} title="No sales on this day" description="Use the arrows to move to another day." />
        ) : (
          <>
            <div
              className={cn(
                "grid gap-3 md:grid-cols-2",
                summary.linear > 0 ? "xl:grid-cols-4" : "xl:grid-cols-3",
              )}
            >
              <StatCard
                title="Revenue"
                value={formatETB(summary.revenue)}
                subtext="At recorded sale prices"
                icon={Banknote}
                variant="primary"
              />
              <StatCard
                title="Tiles sold"
                value={`${formatNumber(summary.sqm)} m²`}
                icon={Layers}
                variant="success"
              />
              {summary.linear > 0 && (
                <StatCard
                  title="Skirting sold"
                  value={`${formatNumber(summary.linear)} m`}
                  icon={Ruler}
                  variant="info"
                />
              )}
              <StatCard
                title="Transactions"
                value={transactions.length.toLocaleString("en-US")}
                subtext={`${transactions.filter((t) => !t.orderId).length} direct · ${transactions.filter((t) => t.orderId).length} orders`}
                icon={Receipt}
                variant="neutral"
              />
            </div>

            {/* How the money came in */}
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-lg border bg-card px-4 py-3 text-sm">
              {summary.byPayment.map((p) => (
                <span key={p.key} className="tabular-nums">
                  <span className="text-muted-foreground">{p.label}</span>{" "}
                  <span className="font-semibold">{formatETB(p.amount)}</span>
                </span>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="overflow-x-auto">
                <Table className="min-w-190">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className={cn(TH, "w-20 pl-4")}>Time</TableHead>
                      <TableHead className={TH}>Source</TableHead>
                      <TableHead className={TH}>Product</TableHead>
                      <TableHead className={cn(TH, "text-right")}>Qty</TableHead>
                      <TableHead className={cn(TH, "text-right")}>Price</TableHead>
                      <TableHead className={cn(TH, "pr-4 text-right")}>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t) => {
                      const highlighted = !!highlightOrderId && t.orderId === highlightOrderId;
                      const source = (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">
                            {t.orderId ? (
                              <>
                                Order{" "}
                                <span className="font-mono text-xs">#{t.orderId.slice(0, 8)}</span>
                              </>
                            ) : (
                              "Direct sale"
                            )}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {t.sellerName ?? "Unknown seller"}
                            {t.paymentMethod && (
                              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                                {PAYMENT_LABEL[t.paymentMethod]}
                              </Badge>
                            )}
                          </span>
                        </div>
                      );

                      // Single-item transactions take one row; multi-item
                      // orders get a header row and indented lines.
                      if (t.items.length === 1) {
                        return (
                          <SaleRow
                            key={t.key}
                            time={formatTime(t.at)}
                            source={source}
                            sale={t.items[0]}
                            highlighted={highlighted}
                          />
                        );
                      }
                      return (
                        <Fragment key={t.key}>
                          <TableRow className={cn("hover:bg-transparent", highlighted && "bg-primary/8")}>
                            <TableCell className="pl-4 align-top text-sm tabular-nums text-muted-foreground">
                              {formatTime(t.at)}
                            </TableCell>
                            <TableCell className="align-top">{source}</TableCell>
                            <TableCell colSpan={3} className="align-top text-sm text-muted-foreground">
                              {t.items.length} items
                            </TableCell>
                            <TableCell className="pr-4 text-right align-top font-semibold tabular-nums">
                              {formatETB(t.total)}
                            </TableCell>
                          </TableRow>
                          {t.items.map((s, i) => (
                            <SaleRow
                              key={s.id}
                              sale={s}
                              nested
                              last={i === t.items.length - 1}
                              highlighted={highlighted}
                            />
                          ))}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SaleRow({
  sale,
  time,
  source,
  nested = false,
  last = true,
  highlighted,
}: {
  sale: SaleRecord;
  time?: string;
  source?: React.ReactNode;
  nested?: boolean;
  /** Only the last line of an order draws the divider below the group. */
  last?: boolean;
  highlighted: boolean;
}) {
  const unit = sale.measurementUnit || "m²";
  return (
    <TableRow
      className={cn(
        nested && "text-muted-foreground",
        !last && "border-b-0",
        highlighted && "bg-primary/8",
      )}
    >
      <TableCell className="pl-4 align-top text-sm tabular-nums text-muted-foreground">
        {time}
      </TableCell>
      <TableCell className="align-top">{source}</TableCell>
      <TableCell className={cn("align-top", nested && "pl-6")}>
        <div className="flex flex-col gap-0.5">
          <span className={cn("font-mono text-sm", !nested && "text-foreground font-medium")}>
            {sale.productCode}
          </span>
          <span className="text-xs text-muted-foreground">
            {[sale.brand, sale.size, sale.finish].filter(Boolean).join(" · ")}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right align-top tabular-nums">
        {formatNumber(sale.quantity)} {unit}
      </TableCell>
      <TableCell className="text-right align-top tabular-nums text-muted-foreground">
        {sale.priceAtSale != null ? `${formatNumber(sale.priceAtSale)} / ${unit}` : "—"}
      </TableCell>
      <TableCell
        className={cn(
          "pr-4 text-right align-top tabular-nums",
          !nested && "font-semibold text-foreground",
        )}
      >
        {sale.priceAtSale != null ? formatETB(lineTotal(sale)) : "—"}
      </TableCell>
    </TableRow>
  );
}

function BackLink() {
  return (
    <Link
      href="/sales/log"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Sales Log
    </Link>
  );
}

function DaySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-12 rounded-lg" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
