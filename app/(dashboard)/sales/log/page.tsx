"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEthiopian } from "@/lib/ethiopian-calendar";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";

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
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<DateGroup | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

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

  // Group all sales by date
  const dateGroups: DateGroup[] = [];
  if (data) {
    const map = new Map<string, DateGroup>();
    for (const sale of data) {
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
    for (const g of map.values()) dateGroups.push(g);
    dateGroups.sort(
      (a, b) =>
        new Date(b.items[0].createdAt).getTime() -
        new Date(a.items[0].createdAt).getTime(),
    );
  }

  const totalTransactions = data?.length ?? 0;
  const totalTileSold =
    data
      ?.filter((r) => (r.measurementUnit || "m²") === "m²")
      .reduce((s, r) => s + r.quantity, 0) ?? 0;
  const totalSkirtingSold =
    data
      ?.filter((r) => r.measurementUnit === "m")
      .reduce((s, r) => s + r.quantity, 0) ?? 0;
  const totalQuantity = totalTileSold + totalSkirtingSold;
  const daysCount = dateGroups.length;

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Sales Log</h1>
          <p className="text-muted-foreground">
            Click a date to view that day&apos;s transactions.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 gap-2"
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 shrink-0">
        <StatCard
          title="Total Transactions"
          value={totalTransactions}
          icon={History}
          variant="blue"
        />
        <StatCard
          title="Total Quantity Sold"
          value={
            <>
              {totalTileSold.toFixed(2)}{" "}
              <span className="text-base font-medium text-muted-foreground">
                m²
              </span>
            </>
          }
          subtext={
            totalSkirtingSold > 0
              ? `+ ${totalSkirtingSold.toFixed(2)} m skirting`
              : undefined
          }
          icon={Package}
          variant="emerald"
        />
        <StatCard
          title="Days Recorded"
          value={daysCount}
          icon={Calendar}
          variant="amber"
        />
      </div>

      {/* Dates table */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-destructive bg-destructive/5 rounded-xl border border-destructive/20 p-8">
              <p className="font-bold">Error Loading Sales Log</p>
              <p className="text-sm opacity-80">{(error as Error).message}</p>
            </div>
          </div>
        ) : (
          <Card className="p-0 h-full border shadow-sm flex flex-col overflow-hidden">
            <Table className="h-full">
              <TableHeader className="bg-background sticky top-0 z-10 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Transactions
                  </TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Total Sold
                  </TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Revenue
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="flex-1">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent h-[56px]">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-2.5 w-20" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-5 w-8 ml-auto rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-3.5 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : dateGroups.length > 0 ? (
                  dateGroups.map((group) => (
                    <TableRow
                      key={group.date}
                      className="cursor-pointer border-b transition-colors hover:bg-muted/40 h-[56px]"
                      onClick={() => setSelectedDate(group)}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
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
                        <span className="text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
                          {group.total.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {group.grossTotal !== null
                          ? `${group.grossTotal.toFixed(2)} ETB`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4}>
                      <EmptyState
                        icon={ShoppingCart}
                        title="No sales records found"
                        description="Sales you record will show up here, grouped by day."
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Import Sales Log
            </DialogTitle>
            <DialogDescription>
              Paste tab-separated data (copied from Excel / Sheets). Dates must
              be in Ethiopian calendar format{" "}
              <span className="font-mono text-xs">DD/MM/YYYY</span>. The header
              row is optional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md bg-muted/60 px-3 py-2 text-[11px] font-mono text-muted-foreground whitespace-pre">
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
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {importResult.inserted} rows imported
                  {importResult.skipped > 0 && (
                    <span className="text-destructive">
                      , {importResult.skipped} skipped
                    </span>
                  )}
                </div>
                {importResult.skippedDetails.length > 0 && (
                  <ul className="text-xs text-destructive space-y-0.5 max-h-32 overflow-auto">
                    {importResult.skippedDetails.map((s, i) => (
                      <li key={i} className="flex items-start gap-1">
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
        <SheetContent
          className="flex flex-col p-0 gap-0"
          style={{ width: "700px", maxWidth: "700px" }}
        >
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
                ? ` \u2014 ${selectedDate.grossTotal.toFixed(2)} ETB total`
                : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-auto">
            <div className="w-175">
              <Table>
                <TableHeader className="bg-background sticky top-0 z-10 border-b">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Product
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Brand
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Size / Finish
                    </TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Qty
                    </TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Unit Price
                    </TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDate?.items.map((sale) => {
                    const lineTotal =
                      sale.priceAtSale !== null
                        ? sale.quantity * sale.priceAtSale
                        : null;
                    const finishDot = sale.finish?.toLowerCase().includes("polish")
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
                          <p className="font-semibold text-sm">{sale.productName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {sale.productCode}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {sale.brand}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${finishDot}`} />
                            <span className="text-sm text-muted-foreground">
                              {sale.size} · {sale.finish}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
                            {sale.quantity.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50 ml-0.5">
                            {sale.measurementUnit || "m²"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                          {sale.priceAtSale !== null &&
                          sale.priceAtSale !== undefined
                            ? sale.priceAtSale.toFixed(2)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-sm">
                          {lineTotal !== null ? lineTotal.toFixed(2) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
