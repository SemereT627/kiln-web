"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { formatETB, formatNumber, formatQuantity } from "@/lib/utils";

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
  const router = useRouter();
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
  // Averages are per day *with sales*, matching what the table lists.
  const perDay = (total: number) => (daysCount > 0 ? total / daysCount : 0);

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
    enabled: !!highlightOrderId,
  });

  useEffect(() => {
    if (!orderLookup) return;
    router.replace(
      `/sales/log/${toDateParam(new Date(orderLookup.createdAt))}?order=${highlightOrderId}`,
    );
  }, [orderLookup, router, highlightOrderId]);


  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Sales Log
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Click a date to view that day&apos;s transactions.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 shrink-0 sm:grid-cols-3">
        <StatCard
          title="Total Transactions"
          value={totalTransactions}
          subtext={
            daysCount > 0
              ? `≈ ${formatNumber(perDay(totalTransactions), 1)} per sales day`
              : "No sales recorded yet"
          }
          icon={History}
          variant="info"
        />
        <StatCard
          title="Total Quantity Sold"
          value={
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span>
                {formatNumber(totalTileSold)}{" "}
                <span className="text-base font-medium text-muted-foreground">
                  m²
                </span>
              </span>
              {totalSkirtingSold > 0 && (
                <span className="text-xs font-normal tracking-normal text-muted-foreground">
                  + {formatQuantity(totalSkirtingSold, "m")} skirting
                </span>
              )}
            </span>
          }
          subtext={
            daysCount > 0
              ? `≈ ${formatNumber(perDay(totalTileSold))} m² of tiles per sales day`
              : "No sales recorded yet"
          }
          icon={Package}
          variant="success"
        />
        <div className="col-span-2 flex *:w-full sm:col-span-1">
          <StatCard
            title="Days Recorded"
            value={daysCount}
            subtext={
              dateFrom || dateTo
                ? "Days with sales in the selected range"
                : "Days with at least one sale"
            }
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
                          onClick={() => router.push(`/sales/log/${row.date}`)}
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

    </div>
  );
}
