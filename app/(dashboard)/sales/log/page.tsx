"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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

interface DaySummary {
  date: string; // "YYYY-MM-DD", Addis Ababa calendar day
  transactionCount: number;
  totalSqm: number;
  totalLinear: number;
  grossTotal: number | null;
}

interface ImportResult {
  inserted: number;
  skipped: number;
  skippedDetails: {
    row: { date: string; productCode: string };
    reason: string;
  }[];
}

/** Parses a plain "YYYY-MM-DD" string as a local-time Date, avoiding the
 * UTC-midnight shift `new Date("YYYY-MM-DD")` would apply in timezones
 * west of UTC. */
function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatGreg(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** yyyy-mm-dd in local time — matches the day-picker's intended calendar
 * day, sent to the API's dateFrom/dateTo params. */
function toDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [autoOpened, setAutoOpened] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const hasDateFilter = !!dateFrom || !!dateTo;
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const changeDateRange = (range: {
    from: Date | undefined;
    to: Date | undefined;
  }) => {
    setDateFrom(range.from);
    setDateTo(range.to);
    setCurrentPage(1);
  };

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

  const { data: summaryResponse, isLoading, error } = useQuery({
    queryKey: [
      "sales",
      "summary",
      currentPage,
      dateFrom?.getTime(),
      dateTo?.getTime(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });
      if (dateFrom) params.set("dateFrom", toDateParam(dateFrom));
      if (dateTo) params.set("dateTo", toDateParam(dateTo));
      const res = await fetch(`/api/sales/summary?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch sales summary");
      return res.json();
    },
  });

  const dayRows: DaySummary[] = summaryResponse?.data ?? [];
  const totalDays: number = summaryResponse?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalDays / itemsPerPage));
  const totalTransactions = summaryResponse?.summary?.totalTransactions ?? 0;
  const totalTileSold = summaryResponse?.summary?.totalSqm ?? 0;
  const totalSkirtingSold = summaryResponse?.summary?.totalLinear ?? 0;
  const daysCount = summaryResponse?.summary?.totalDays ?? 0;

  // Resolve which calendar day an order's sale falls on (deep link from the
  // Audit Logs diff dialog) — we only need the date, not the paginated day
  // list, so this never depends on which page happens to contain it.
  const { data: orderLookup } = useQuery({
    queryKey: ["sales", "order-lookup", highlightOrderId],
    queryFn: async () => {
      const res = await fetch(
        `/api/sales?orderId=${highlightOrderId}&limit=1`,
      );
      if (!res.ok) throw new Error("Failed to resolve order");
      const json = await res.json();
      return (json.data?.[0] as SaleRecord | undefined) ?? null;
    },
    enabled: !!highlightOrderId && !autoOpened,
  });

  useEffect(() => {
    if (autoOpened || !orderLookup) return;
    setAutoOpened(true);
    setSelectedDateStr(toDateParam(new Date(orderLookup.createdAt)));
  }, [autoOpened, orderLookup]);

  // Itemized sales for whichever day is open in the drawer — the only place
  // this page ever fetches full per-sale detail now.
  const { data: dayDetail, isLoading: isDayLoading } = useQuery({
    queryKey: ["sales", "day", selectedDateStr],
    queryFn: async () => {
      const res = await fetch(
        `/api/sales?dateFrom=${selectedDateStr}&dateTo=${selectedDateStr}&limit=-1`,
      );
      if (!res.ok) throw new Error("Failed to fetch day detail");
      const json = await res.json();
      return (json.data || []) as SaleRecord[];
    },
    enabled: !!selectedDateStr,
  });

  const dayItems = dayDetail ?? [];
  const dayCount = dayItems.length;
  const dayGrossTotal = dayItems.some((s) => s.priceAtSale !== null)
    ? dayItems.reduce(
        (s, sale) => s + (sale.priceAtSale !== null ? sale.quantity * sale.priceAtSale : 0),
        0,
      )
    : null;

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden animate-in fade-in duration-500 md:gap-6">
      {/* Header */}
      <div className="shrink-0">
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
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
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
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border">
            <div className="bg-muted/30 border-b shrink-0 py-3.5 px-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <DateRangePicker
                  from={dateFrom}
                  to={dateTo}
                  onChange={changeDateRange}
                  placeholder="Filter"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
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
                  ) : dayRows.length > 0 ? (
                    dayRows.map((row) => {
                      const dateObj = parseDateOnly(row.date);
                      return (
                        <TableRow
                          key={row.date}
                          className="group cursor-pointer border-b transition-colors hover:bg-muted/40 h-[56px] active:bg-muted/60"
                          onClick={() => setSelectedDateStr(row.date)}
                        >
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 ring-1 ring-primary/10 flex items-center justify-center shrink-0">
                                <Calendar className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm">
                                  {formatGreg(dateObj)}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatEthiopian(dateObj)}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm font-medium tabular-nums">
                              {row.transactionCount}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span>
                                <span className="text-sm font-bold tabular-nums text-primary">
                                  {formatNumber(row.totalSqm)}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50 ml-0.5">
                                  m²
                                </span>
                              </span>
                              {row.totalLinear > 0 && (
                                <span className="text-[10px] text-muted-foreground/60">
                                  +{formatNumber(row.totalLinear)} m
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="pr-4">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-sm font-semibold text-foreground tabular-nums">
                                {row.grossTotal !== null
                                  ? formatETB(row.grossTotal)
                                  : "—"}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
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

        {!error && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 shrink-0">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {Math.min(currentPage * itemsPerPage, totalDays)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{totalDays}</span>{" "}
              days
            </p>
            <Pagination className="w-auto mx-0">
              <PaginationContent className="gap-1.5">
                <PaginationItem>
                  <PaginationPrevious
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-40"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="flex h-8 items-center rounded-lg border bg-background px-3 text-xs font-medium tabular-nums">
                    {currentPage} / {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-40"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
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
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-[11px] font-mono text-muted-foreground overflow-x-auto">
              <div className="grid grid-cols-[auto_auto_auto_auto_auto] gap-x-6 w-fit">
                <span>Date</span>
                <span>Product ID (CODE)</span>
                <span>Ceramic Name</span>
                <span>Size</span>
                <span>Quantity Sold (m2)</span>
                <span>16/06/2018</span>
                <span>005</span>
                <span>ARERTI</span>
                <span>60*60 N</span>
                <span>1.44</span>
              </div>
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
        open={!!selectedDateStr}
        onOpenChange={(open) => {
          if (!open) setSelectedDateStr(null);
        }}
      >
        <SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-[calc(100%-2rem)] data-[side=right]:sm:w-full data-[side=right]:sm:max-w-175">
          <SheetHeader className="p-6 pb-4 shrink-0 border-b">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col gap-0.5">
                <SheetTitle>
                  {selectedDateStr ? formatGreg(parseDateOnly(selectedDateStr)) : ""}
                </SheetTitle>
                {selectedDateStr && (
                  <span className="text-xs text-muted-foreground font-normal">
                    {formatEthiopian(parseDateOnly(selectedDateStr))}
                  </span>
                )}
              </div>
            </div>
            <SheetDescription>
              {isDayLoading
                ? "Loading…"
                : `${dayCount} transaction${dayCount !== 1 ? "s" : ""}${
                    dayGrossTotal !== null
                      ? ` — ${formatETB(dayGrossTotal)} total`
                      : ""
                  }`}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-auto">
            {isDayLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : (
              (() => {
                const orderGroups = groupByOrder(dayItems);
                return (
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
                );
              })()
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
