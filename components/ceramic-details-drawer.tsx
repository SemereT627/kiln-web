"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Box,
  Tag,
  Layers,
  Sparkles,
  TrendingUp,
  ShoppingCart,
  Calendar,
  Package,
  Info,
  PackagePlus,
  ChevronRight,
  Truck,
  FileText,
  ClipboardList,
  History,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/user-provider";
import { RestockForm } from "@/components/restock-form";
import { ProductImage } from "@/components/product-image";
import { StockBadge } from "@/components/stock-badge";
import { formatEthiopian } from "@/lib/ethiopian-calendar";

interface CeramicDetailsDrawerProps {
  ceramic: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatGreg(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CeramicDetailsDrawer({
  ceramic,
  open,
  onOpenChange,
}: CeramicDetailsDrawerProps) {
  const userProfile = useUser();
  const isAdmin = userProfile?.role === "admin";
  const queryClient = useQueryClient();

  const [soldHistoryOpen, setSoldHistoryOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);

  // Fetch sold history when modal opens
  const { data: soldHistory, isLoading: loadingSold } = useQuery({
    queryKey: ["sales", "ceramic", ceramic?._id],
    queryFn: async () => {
      const res = await fetch(`/api/sales?ceramicId=${ceramic._id}&limit=-1`);
      if (!res.ok) throw new Error("Failed to fetch sold history");
      const json = await res.json();
      return (json.data || []) as Array<{
        id: string;
        quantity: number;
        priceAtSale: number | null;
        createdAt: string;
        measurementUnit: string;
      }>;
    },
    enabled: soldHistoryOpen && !!ceramic?._id,
  });

  // Fetch restock history (always, for the detail panel)
  const { data: restockHistory, isLoading: loadingRestock } = useQuery({
    queryKey: ["restock", ceramic?._id],
    queryFn: async () => {
      const res = await fetch(`/api/ceramics/${ceramic._id}/restock`);
      if (!res.ok) throw new Error("Failed to fetch restock history");
      const json = await res.json();
      return (json.data || []) as Array<{
        id: string;
        quantity: number;
        entryType: string;
        direction: "add" | "remove";
        reason: string | null;
        supplier: string | null;
        notes: string | null;
        createdAt: string;
      }>;
    },
    enabled: open && !!ceramic?._id,
  });

  if (!ceramic) return null;

  const unit = ceramic.measurementUnit || "m²";

  const totalSoldQty =
    soldHistory?.reduce((s, r) => s + r.quantity, 0) ?? ceramic.soldStock;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col gap-0 p-4 data-[side=right]:w-[calc(100%-2rem)] data-[side=right]:sm:w-full data-[side=right]:sm:max-w-175">
          <SheetHeader className="p-0 space-y-4 pr-6">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="font-mono text-[10px]">
                {ceramic.productId}
              </Badge>
              <StockBadge stock={ceramic.currentStock} />
            </div>
            <SheetTitle className="text-2xl font-bold">
              {ceramic.name}
            </SheetTitle>
            <SheetDescription>
              Detailed overview of product specifications and current inventory
              status.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-8 space-y-8 pb-8">
            {/* Product Image */}
            {ceramic.imageUrl && (
              <ProductImage
                src={ceramic.imageUrl}
                alt={ceramic.name}
                className="w-full rounded-2xl border border-border/60"
                iconSize="lg"
                sizes="(max-width: 640px) 100vw, 580px"
                fit="contain"
              />
            )}

            {/* Key Stats */}
            <div className="grid grid-cols-2 gap-4">
              {/* Current Stock */}
              <div className="rounded-2xl bg-muted/40 p-4 border shadow-xs transition-shadow hover:shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-slate-500/10">
                    <Package className="size-3.5 text-slate-600 dark:text-slate-400" />
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider">
                    Current Stock
                  </span>
                </div>
                <div className="text-2xl font-bold tracking-tight">
                  {ceramic.currentStock.toFixed(2)}{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    {unit}
                  </span>
                </div>
              </div>

              {/* Total Sold — Clickable */}
              <button
                type="button"
                onClick={() => setSoldHistoryOpen(true)}
                className="group rounded-2xl bg-primary/5 p-4 border border-primary/10 text-left shadow-xs transition-all hover:bg-primary/10 hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer w-full"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-primary/70">
                    <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10">
                      <ShoppingCart className="size-3.5" />
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Total Sold
                    </span>
                  </div>
                  <ChevronRight className="size-3.5 text-primary/40 group-hover:text-primary/70 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-2xl font-bold text-primary tracking-tight">
                  {ceramic.soldStock.toFixed(2)}{" "}
                  <span className="text-sm font-medium opacity-70">{unit}</span>
                </div>
                <p className="text-[10px] text-primary/50 mt-1 group-hover:text-primary/70 transition-colors">
                  Click to view history
                </p>
              </button>
            </div>

            {/* Specifications */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Info className="size-4 text-primary" />
                Specifications
              </h4>
              <div className="grid gap-3">
                <div className="flex items-center justify-between py-2 border-b border-dashed">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Tag className="size-4" />
                    <span>Brand</span>
                  </div>
                  <span className="font-medium">{ceramic.brand}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dashed">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Layers className="size-4" />
                    <span>Size</span>
                  </div>
                  <span className="font-medium">{ceramic.size}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dashed">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="size-4" />
                    <span>Finish</span>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {ceramic.finish}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-dashed">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="size-4" />
                    <span>Initial Stock</span>
                  </div>
                  <span className="font-medium">
                    {ceramic.initialStock.toFixed(2)} {unit}
                  </span>
                </div>
                {ceramic.pricePerUnit != null && (
                  <div className="flex items-center justify-between py-2 border-b border-dashed">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Tag className="size-4" />
                      <span>Price / {unit}</span>
                    </div>
                    <span className="font-medium">
                      {Number(ceramic.pricePerUnit).toFixed(2)} ETB
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Restock History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <ClipboardList className="size-4 text-primary" />
                  Restock History
                </h4>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setRestockOpen(true)}
                  >
                    <PackagePlus className="size-3.5" />
                    Add Restock
                  </Button>
                )}
              </div>

              {loadingRestock ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded-lg bg-muted animate-pulse"
                    />
                  ))}
                </div>
              ) : !restockHistory || restockHistory.length === 0 ? (
                <div className="text-center py-6 rounded-xl border border-dashed text-muted-foreground text-sm">
                  <PackagePlus className="size-8 mx-auto mb-2 opacity-20" />
                  No restock records yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {restockHistory.slice(0, 5).map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              entry.entryType === "Restock"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px] h-5 px-1.5"
                          >
                            {entry.entryType}
                          </Badge>
                          <span className="font-bold text-sm">
                            {entry.direction === "remove" ? "-" : "+"}
                            {entry.quantity.toFixed(2)} {unit}
                          </span>
                          {entry.reason && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 px-1.5 capitalize"
                            >
                              {entry.reason}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatGreg(entry.createdAt)}
                        </span>
                      </div>
                      {entry.supplier && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Truck className="size-3" />
                          {entry.supplier}
                        </div>
                      )}
                      {entry.notes && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <FileText className="size-3 mt-0.5 shrink-0" />
                          <span className="leading-relaxed">{entry.notes}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {restockHistory.length > 5 && (
                    <p className="text-center text-xs text-muted-foreground pt-1">
                      +{restockHistory.length - 5} older entries
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3.5" />
                <span>
                  Registered on{" "}
                  {new Date(ceramic.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <History className="size-3.5" />
                <span>
                  Last updated{" "}
                  {new Date(ceramic.updatedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Sold History Sheet ── */}
      <Sheet open={soldHistoryOpen} onOpenChange={setSoldHistoryOpen}>
        <SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-[calc(100%-2.5rem)] data-[side=right]:sm:w-full data-[side=right]:sm:max-w-175">
          <SheetHeader className="p-6 pb-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Sales History — {ceramic.name}
            </SheetTitle>
            <SheetDescription>
              All recorded sales transactions for this product.
              {soldHistory && soldHistory.length > 0 && (
                <span className="ml-1 font-semibold text-foreground">
                  {soldHistory.length} transaction
                  {soldHistory.length !== 1 ? "s" : ""}
                  {" · "}
                  {soldHistory
                    .reduce((s, r) => s + r.quantity, 0)
                    .toFixed(2)}{" "}
                  {unit} total
                </span>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-auto">
            {loadingSold ? (
              <Table>
                <TableBody>
                  {[1, 2, 3, 4].map((i) => (
                    <TableRow key={i} className="hover:bg-transparent h-[52px]">
                      <TableCell className="pl-4">
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-24" />
                          <Skeleton className="h-2.5 w-16" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-16 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-16 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-3.5 w-16 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : !soldHistory || soldHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 opacity-10 mb-3" />
                <p className="text-sm font-medium">No sales records found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-background sticky top-0 z-10 border-b">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Quantity
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
                  {soldHistory.map((sale) => {
                    const lineTotal =
                      sale.priceAtSale !== null
                        ? sale.quantity * sale.priceAtSale
                        : null;
                    return (
                      <TableRow
                        key={sale.id}
                        className="border-b transition-colors hover:bg-muted/40 h-[52px]"
                      >
                        <TableCell className="pl-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">
                              {formatGreg(sale.createdAt)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatEthiopian(new Date(sale.createdAt))}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
                            {sale.quantity.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50 ml-0.5">
                            {unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                          {sale.priceAtSale !== null &&
                          sale.priceAtSale !== undefined
                            ? `${sale.priceAtSale.toFixed(2)} ETB`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-sm">
                          {lineTotal !== null
                            ? `${lineTotal.toFixed(2)} ETB`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Restock Form ── */}
      {isAdmin && (
        <RestockForm
          open={restockOpen}
          onOpenChange={setRestockOpen}
          product={ceramic}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["ceramics"] });
            queryClient.invalidateQueries({
              queryKey: ["restock", ceramic._id],
            });
          }}
        />
      )}
    </>
  );
}
