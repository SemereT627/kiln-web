"use client";

import {
  Fragment,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  Calendar,
  History,
  Package,
  Upload,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEthiopian } from "@/lib/ethiopian-calendar";
import { StatCard } from "@/components/stat-card";
import { DateRangePicker } from "@/components/date-range-picker";
import { EmptyState } from "@/components/empty-state";
import { cn, formatETB, formatNumber, formatQuantity } from "@/lib/utils";

interface SaleRecord {
  id: string;
  quantity: number;
  priceAtSale: number | null;
  createdAt: string;
  productName: string;
  productCode: string;
  brand: string;
  size: string;
  finish: string;
  measurementUnit: string;
  orderId: string | null;
  orderSellerName: string | null;
  orderPaymentMethod: string | null;
}

interface OrderGroup {
  key: string;
  orderId: string | null;
  sellerName: string | null;
  paymentMethod: string | null;
  items: SaleRecord[];
}

function groupByOrder(items: SaleRecord[]): OrderGroup[] {
  const groups: OrderGroup[] = [];
  const byOrderId = new Map<string, OrderGroup>();

  for (const sale of items) {
    if (!sale.orderId) {
      groups.push({
        key: `direct-${sale.id}`,
        orderId: null,
        sellerName: null,
        paymentMethod: null,
        items: [sale],
      });
      continue;
    }
    let group = byOrderId.get(sale.orderId);
    if (!group) {
      group = {
        key: sale.orderId,
        orderId: sale.orderId,
        sellerName: sale.orderSellerName,
        paymentMethod: sale.orderPaymentMethod,
        items: [],
      };
      byOrderId.set(sale.orderId, group);
      groups.push(group);
    }
    group.items.push(sale);
  }

  return groups;
}

interface DateGroup {
  date: string;
  total: number;
  count: number;
  grossTotal: number | null;
  items: SaleRecord[];
}

interface ImportResult {
  inserted: number;
  skipped: number;
  skippedDetails: {
    row: { date: string; productCode: string };
    reason: string;
  }[];
}

function formatGreg(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseTSV(raw: string) {
  const lines = raw.trim().split("\n").filter(Boolean);
  // Skip header row if present
  const dataLines = lines[0]?.toLowerCase().includes("date")
    ? lines.slice(1)
    : lines;
  return dataLines
    .map((line) => {
      const cols = line.split(/\t/);
      return {
        date: cols[0]?.trim() ?? "",
        productCode: cols[1]?.trim() ?? "",
        ceramicName: cols[2]?.trim() ?? "",
        size: cols[3]?.trim() ?? "",
        quantity: parseFloat(cols[4]?.trim() ?? "0"),
      };
    })
    .filter((r) => r.date && r.productCode && r.quantity > 0);
}

export default function SalesLogPage() {
  return (
    <Suspense fallback={null}>
      <SalesLogPageInner />
    </Suspense>
  );
}

function SalesLogPageInner() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const highlightOrderId = searchParams.get("order");
  const autoOpenedRef = useRef(false);
  const [selectedDate, setSelectedDate] = useState<DateGroup | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const hasDateFilter = !!dateFrom || !!dateTo;

  const handleImport = async () => {
    const rows = parseTSV(importText);
    if (rows.length === 0) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/sales/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setImportResult(json);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    } catch (e: any) {
      setImportResult({
        inserted: 0,
        skipped: rows.length,
        skippedDetails: [
          { row: { date: "", productCode: "" }, reason: e.message },
        ],
      });
    } finally {
      setImporting(false);
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["sales", "all"],
    queryFn: async () => {
      const res = await fetch("/api/sales?limit=-1");
      if (!res.ok) throw new Error("Failed to fetch sales");
      const json = await res.json();
      return (json.data || []) as SaleRecord[];
    },
  });

  // Apply the from/to date filter before anything downstream (stats + grouping)
  // derives from it, so both stay in sync with the selected range.
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!hasDateFilter) return data;
    const from = dateFrom
      ? new Date(
          dateFrom.getFullYear(),
          dateFrom.getMonth(),
          dateFrom.getDate(),
          0,
          0,
          0,
          0,
        )
      : null;
    const to = dateTo
      ? new Date(
          dateTo.getFullYear(),
          dateTo.getMonth(),
          dateTo.getDate(),
          23,
          59,
          59,
          999,
        )
      : null;
    return data.filter((sale) => {
      const t = new Date(sale.createdAt);
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });
  }, [data, dateFrom, dateTo, hasDateFilter]);

  // Group all sales by date
  const dateGroups: DateGroup[] = useMemo(() => {
    const groups: DateGroup[] = [];
    const map = new Map<string, DateGroup>();
    for (const sale of filteredData) {
      const key = new Date(sale.createdAt).toLocaleDateString();
      if (!map.has(key)) {
        map.set(key, {
          date: key, // keep as locale string (used as map key)
          total: 0,
          count: 0,
          grossTotal: null,
          items: [],
        });
      }
      const group = map.get(key)!;
      group.total += sale.quantity;
      group.count += 1;
      if (sale.priceAtSale !== null) {
        group.grossTotal =
          (group.grossTotal ?? 0) + sale.quantity * sale.priceAtSale;
      }
      group.items.push(sale);
    }
    for (const g of map.values()) groups.push(g);
    groups.sort(
      (a, b) =>
        new Date(b.items[0].createdAt).getTime() -
        new Date(a.items[0].createdAt).getTime(),
    );
    return groups;
  }, [filteredData]);

  useEffect(() => {
    if (autoOpenedRef.current || !highlightOrderId || dateGroups.length === 0)
      return;
    const match = dateGroups.find((g) =>
      g.items.some((item) => item.orderId === highlightOrderId),
    );
    if (match) {
      autoOpenedRef.current = true;
      setSelectedDate(match);
    }
  }, [dateGroups, highlightOrderId]);

  const totalTransactions = filteredData.length;
  const totalTileSold = filteredData
    .filter((r) => (r.measurementUnit || "m²") === "m²")
    .reduce((s, r) => s + r.quantity, 0);
  const totalSkirtingSold = filteredData
    .filter((r) => r.measurementUnit === "m")
    .reduce((s, r) => s + r.quantity, 0);
  const totalQuantity = totalTileSold + totalSkirtingSold;
  const daysCount = dateGroups.length;

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden animate-in fade-in duration-500 md:gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 shrink-0">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
            Sales
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
            Sales Log
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Click a date to view that day&apos;s transactions.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={({ from, to }) => {
              setDateFrom(from);
              setDateTo(to);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setImportOpen(true);
              setImportResult(null);
              setImportText("");
            }}
          >
            <Upload className="h-4 w-4" />
            Import Log
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 shrink-0 sm:grid-cols-3 md:gap-4">
        <StatCard
          title="Total Transactions"
          value={totalTransactions}
          icon={History}
          variant="info"
        />
        <StatCard
          title="Total Quantity Sold"
          value={
            <>
              {formatNumber(totalTileSold)}{" "}
              <span className="text-base font-medium text-muted-foreground">
                m²
              </span>
            </>
          }
          subtext={
            totalSkirtingSold > 0
              ? `+ ${formatQuantity(totalSkirtingSold, "m")} skirting`
              : undefined
          }
          icon={Package}
          variant="success"
        />
        <div className="col-span-2 flex *:w-full sm:col-span-1">
          <StatCard
            title="Days Recorded"
            value={daysCount}
            icon={Calendar}
            variant="neutral"
          />
        </div>
      </div>

      {/* Dates table */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <p className="font-semibold text-sm">Error Loading Sales Log</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(error as Error).message}
              </p>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "h-full flex flex-col overflow-hidden",
              "md:rounded-xl md:border md:bg-card md:shadow-xs md:transition-shadow md:duration-200 md:hover:shadow-md",
            )}
          >
            <div className="flex-1 flex flex-col overflow-auto">
              <Table className="min-w-125">
                <TableHeader className="border-b">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky top-0 z-10 bg-background pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Transactions
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Total Sold
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Revenue
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow
                        key={i}
                        className="hover:bg-transparent h-[56px]"
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                            <div className="space-y-1.5">
                              <Skeleton className="h-3.5 w-28" />
                              <Skeleton className="h-2.5 w-20" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-8 ml-auto rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3.5 w-16 ml-auto" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3.5 w-20 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : dateGroups.length > 0 ? (
                    dateGroups.map((group) => (
                      <TableRow
                        key={group.date}
                        className="group cursor-pointer border-b transition-colors hover:bg-muted/40 h-[56px] active:bg-muted/60"
                        onClick={() => setSelectedDate(group)}
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/10 flex items-center justify-center shrink-0">
                              <Calendar className="h-4 w-4 text-blue-500" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm">
                                {formatGreg(group.items[0].createdAt)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatEthiopian(
                                  new Date(group.items[0].createdAt),
                                )}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-medium tabular-nums">
                            {group.count}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-bold tabular-nums text-primary">
                            {formatNumber(group.total)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50 ml-0.5">
                            m²
                          </span>
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm font-semibold text-foreground tabular-nums">
                              {group.grossTotal !== null
                                ? formatETB(group.grossTotal)
                                : "—"}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4}>
                        {hasDateFilter ? (
                          <EmptyState
                            icon={ShoppingCart}
                            title="No sales in this range"
                            description="Try a wider date range, or clear the filter."
                          />
                        ) : (
                          <EmptyState
                            icon={ShoppingCart}
                            title="No sales records found"
                            description="Sales you record will show up here, grouped by day."
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <Upload className="h-3.5 w-3.5 text-primary" />
              </span>
              Import Sales Log
            </DialogTitle>
            <DialogDescription>
              Paste tab-separated data (copied from Excel / Sheets). Dates must
              be in Ethiopian calendar format{" "}
              <span className="font-mono text-xs">DD/MM/YYYY</span>. The header
              row is optional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-[11px] font-mono text-muted-foreground whitespace-pre overflow-x-auto">
              Date{"\t"}Product ID (CODE){"\t"}Ceramic Name{"\t"}Size{"\t"}
              Quantity Sold (m2){"\n"}
              16/06/2018{"\t"}005{"\t"}ARERTI{"\t"}60*60 N{"\t"}1.44
            </div>

            <Textarea
              placeholder="Paste your tab-separated data here…"
              className="min-h-50 font-mono text-xs"
              value={importText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setImportText(e.target.value)
              }
              disabled={importing}
            />

            {importResult && (
              <div className="rounded-lg border p-3.5 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  {importResult.inserted} rows imported
                  {importResult.skipped > 0 && (
                    <span className="text-destructive">
                      , {importResult.skipped} skipped
                    </span>
                  )}
                </div>
                {importResult.skippedDetails.length > 0 && (
                  <ul className="text-xs text-destructive space-y-1 max-h-32 overflow-auto rounded-md bg-destructive/5 p-2">
                    {importResult.skippedDetails.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>
                          {s.row.date} / {s.row.productCode}: {s.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setImportOpen(false)}
              disabled={importing}
            >
              Close
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || !importText.trim()}
            >
              {importing
                ? "Importing…"
                : `Import ${parseTSV(importText).length > 0 ? parseTSV(importText).length + " rows" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day detail drawer */}
      <Sheet
        open={!!selectedDate}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
        }}
      >
        <SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-[calc(100%-2rem)] data-[side=right]:sm:w-full data-[side=right]:sm:max-w-175">
          <SheetHeader className="p-6 pb-4 shrink-0 border-b">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col gap-0.5">
                <SheetTitle>
                  {selectedDate
                    ? formatGreg(selectedDate.items[0].createdAt)
                    : ""}
                </SheetTitle>
                {selectedDate && (
                  <span className="text-xs text-muted-foreground font-normal">
                    {formatEthiopian(new Date(selectedDate.items[0].createdAt))}
                  </span>
                )}
              </div>
            </div>
            <SheetDescription>
              {selectedDate?.count} transaction
              {selectedDate?.count !== 1 ? "s" : ""}
              {selectedDate?.grossTotal !== null &&
              selectedDate?.grossTotal !== undefined
                ? ` \u2014 ${formatETB(selectedDate.grossTotal)} total`
                : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-auto">
            {(() => {
              const orderGroups = groupByOrder(selectedDate?.items ?? []);
              return (
                <>
                  <div className="overflow-x-auto">
                    <Table className="min-w-150">
                      <TableHeader className="border-b">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="sticky top-0 z-10 bg-background pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                            Product
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                            Brand
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                            Size / Finish
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-background text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                            Qty
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-background text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                            Unit Price
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-background text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                            Total
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderGroups.map((group) => {
                          const groupTotal = group.items.reduce(
                            (s, sale) =>
                              s +
                              (sale.priceAtSale != null
                                ? sale.quantity * sale.priceAtSale
                                : 0),
                            0,
                          );
                          const isHighlighted =
                            !!highlightOrderId &&
                            group.orderId === highlightOrderId;
                          return (
                            <Fragment key={group.key}>
                              <TableRow className="hover:bg-transparent border-b">
                                <TableCell
                                  colSpan={6}
                                  className={cn(
                                    "py-2 pl-4",
                                    isHighlighted
                                      ? "bg-primary/10"
                                      : "bg-muted/30",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-xs font-semibold",
                                      isHighlighted
                                        ? "text-primary"
                                        : "text-foreground",
                                    )}
                                  >
                                    {group.orderId
                                      ? `Order #${group.orderId!.slice(0, 8)} · ${group.sellerName ?? "Unknown seller"}`
                                      : "Direct sale"}
                                  </span>
                                </TableCell>
                              </TableRow>
                              {group.items.map((sale) => {
                                const lineTotal =
                                  sale.priceAtSale !== null
                                    ? sale.quantity * sale.priceAtSale
                                    : null;
                                const finishDot = sale.finish
                                  ?.toLowerCase()
                                  .includes("polish")
                                  ? "bg-indigo-400"
                                  : sale.finish?.toLowerCase().includes("decor")
                                    ? "bg-violet-400"
                                    : "bg-zinc-400";
                                return (
                                  <TableRow
                                    key={sale.id}
                                    className="border-b transition-colors hover:bg-muted/40 h-[52px]"
                                  >
                                    <TableCell className="pl-4">
                                      <p className="font-semibold text-sm">
                                        {sale.productName}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                        {sale.productCode}
                                      </p>
                                    </TableCell>
                                    <TableCell className="text-sm text-foreground">
                                      {sale.brand}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1.5">
                                        <div
                                          className={`h-1.5 w-1.5 rounded-full shrink-0 ${finishDot}`}
                                        />
                                        <span className="text-sm text-muted-foreground">
                                          {sale.size} · {sale.finish}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span className="font-bold tabular-nums text-primary">
                                        {formatNumber(sale.quantity)}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground/50 ml-0.5">
                                        {sale.measurementUnit || "m²"}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                                      {sale.priceAtSale !== null &&
                                      sale.priceAtSale !== undefined
                                        ? formatNumber(sale.priceAtSale)
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-semibold text-sm">
                                      {lineTotal !== null
                                        ? formatETB(lineTotal)
                                        : "—"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              <TableRow className="hover:bg-transparent border-b">
                                <TableCell
                                  colSpan={5}
                                  className="text-right text-xs text-muted-foreground pr-3"
                                >
                                  Subtotal
                                </TableCell>
                                <TableCell className="text-right text-xs font-bold tabular-nums pr-4">
                                  {formatETB(groupTotal)}
                                </TableCell>
                              </TableRow>
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
