"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Search,
  Package,
  Plus,
  Minus,
  ShieldAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/product-image";
import { EmptyState } from "@/components/empty-state";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useUser } from "@/components/user-provider";

export default function SalesPage() {
  const userProfile = useUser();
  const isAdmin = userProfile?.role === "admin";

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [saleAmount, setSaleAmount] = useState<number>(0);
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({
    type: "idle",
    message: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const { data: response, isLoading, isFetching } = useQuery({
    queryKey: [
      "ceramics",
      { page: currentPage, search: searchTerm, type: "sales-catalog" },
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/ceramics?page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}`,
      );
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const saleMutation = useMutation({
    mutationFn: async (payload: {
      ceramicId: string;
      quantity: number;
      priceAtSale?: number | null;
    }) => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to log sale");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      const unit = selectedProduct?.measurementUnit || "m²";
      setStatus({
        type: "success",
        message: `Sold ${variables.quantity.toFixed(2)} ${unit} of ${selectedProduct?.name}`,
      });
      setSaleAmount(0);
      setSelectedProduct(null);
      queryClient.invalidateQueries({ queryKey: ["ceramics"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setTimeout(() => setStatus({ type: "idle", message: "" }), 3000);
    },
    onError: (error: any) => {
      setStatus({
        type: "error",
        message: error.message || "An error occurred.",
      });
    },
  });

  if (userProfile && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4 animate-in fade-in duration-500">
        <div className="bg-amber-100 dark:bg-amber-900/30 p-5 rounded-full ring-8 ring-amber-500/5">
          <ShieldAlert className="h-10 w-10 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="max-w-md">
          <h2 className="text-xl font-bold tracking-tight">
            Access Restricted
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5">
            Only administrators are authorized to record sales transactions. If
            you need to log a sale, please contact the store owner.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <a href="/">Return to Dashboard</a>
        </Button>
      </div>
    );
  }

  const data = response?.data || [];
  const totalItems = response?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const skeletonCount = totalItems
    ? Math.min(itemsPerPage, totalItems - (currentPage - 1) * itemsPerPage)
    : itemsPerPage;

  const unit = selectedProduct?.measurementUnit || "m²";
  const price = selectedProduct?.pricePerUnit ?? null;
  const total = price !== null ? saleAmount * price : null;

  const handleSale = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProduct || saleAmount <= 0) return;

    if (saleAmount > selectedProduct.currentStock) {
      setStatus({ type: "error", message: "Insufficient stock available." });
      return;
    }

    saleMutation.mutate({
      ceramicId: selectedProduct._id,
      quantity: saleAmount,
      priceAtSale: price,
    });
  };

  const adjustAmount = (val: number) => {
    setSaleAmount((prev) => Math.max(0, parseFloat((prev + val).toFixed(2))));
  };

  // Quick-add buttons adapt to unit: smaller increments for linear/pcs
  const quickAdds =
    unit === "m²" ? [1, 5, 10, 20, 50, 100] : [1, 2, 5, 10, 20, 50];

  return (
    <div className="flex flex-col gap-6 pr-1 md:h-full animate-in fade-in duration-500 md:overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
            Point of Sale
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
            Sales
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Select a product to record a new sale transaction.
          </p>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, or brand..."
            className="pl-10 h-10 rounded-xl"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchTerm("");
                setCurrentPage(1);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="md:flex-1 md:min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-2">
        {/* Product Catalog */}
        <div className="lg:col-span-8 flex flex-col md:min-h-0 gap-4">
          <Card className="py-0 gap-0 md:flex-1 flex flex-col md:overflow-hidden hover:shadow-xs shadow-xs">
            <CardHeader className="py-3.5 px-5 shrink-0 border-b bg-muted/30 gap-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Product Catalog</CardTitle>
                <Badge variant="outline" className="font-normal">
                  {totalItems} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="md:flex-1 md:overflow-auto p-4 flex flex-col">
              <div
                className={cn(
                  "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 content-start transition-opacity duration-200",
                  isFetching && !isLoading && "opacity-50 pointer-events-none",
                )}
              >
                {isLoading ? (
                  Array.from({ length: skeletonCount }).map((_, i) => (
                    <Skeleton key={i} className="rounded-xl h-[88px]" />
                  ))
                ) : data.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      icon={Package}
                      title="No products found"
                      description="Try a different search term."
                    />
                  </div>
                ) : (
                  data.map((item: any) => {
                    const isOutOfStock = item.currentStock <= 0;
                    const isLow = !isOutOfStock && item.currentStock < 5;
                    const isSelected = selectedProduct?._id === item._id;
                    return (
                      <button
                        type="button"
                        key={item._id}
                        disabled={isOutOfStock}
                        onClick={() => {
                          if (isOutOfStock) return;
                          setSelectedProduct(item);
                          setSaleAmount(0);
                          setStatus({ type: "idle", message: "" });
                        }}
                        className={cn(
                          "group relative flex text-left rounded-xl border transition-all duration-150 p-3 gap-3 items-center",
                          isOutOfStock
                            ? "opacity-40 cursor-not-allowed bg-muted border-transparent"
                            : isSelected
                              ? "bg-primary border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/30 cursor-pointer"
                              : "bg-card border-border hover:border-primary/40 hover:shadow-md shadow-xs cursor-pointer active:scale-[0.98]",
                        )}
                      >
                        <ProductImage
                          src={item.imageUrl}
                          alt={item.name}
                          className={cn(
                            "h-12 w-12 shrink-0 rounded-lg ring-1",
                            isSelected ? "ring-primary-foreground/20" : "ring-border",
                          )}
                          iconSize="sm"
                          sizes="48px"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-semibold truncate text-sm leading-tight",
                            isSelected ? "text-primary-foreground" : "text-foreground",
                          )}>
                            {item.name}
                          </p>
                          <p className={cn(
                            "text-[10px] uppercase tracking-wide font-medium mt-0.5",
                            isSelected ? "text-primary-foreground/60" : "text-muted-foreground",
                          )}>
                            {item.brand} · {item.size}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {isOutOfStock ? (
                              <span className="text-[11px] font-semibold text-destructive">Out of Stock</span>
                            ) : (
                              <>
                                <span className={cn(
                                  "text-[11px] font-bold tabular-nums",
                                  isSelected ? "text-primary-foreground" : "text-foreground",
                                )}>
                                  {item.currentStock.toFixed(2)}
                                </span>
                                <span className={cn(
                                  "text-[10px]",
                                  isSelected ? "text-primary-foreground/60" : "text-muted-foreground",
                                )}>
                                  {item.measurementUnit || "m²"}
                                </span>
                                {isLow && (
                                  <span className={cn(
                                    "ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                    isSelected
                                      ? "bg-white/20 text-white"
                                      : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
                                  )}>
                                    Low
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {item.pricePerUnit != null && (
                          <div className={cn(
                            "shrink-0 text-right",
                          )}>
                            <p className={cn(
                              "text-[11px] font-semibold tabular-nums",
                              isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                            )}>
                              {Number(item.pricePerUnit).toFixed(0)}
                            </p>
                            <p className={cn(
                              "text-[9px] uppercase",
                              isSelected ? "text-primary-foreground/50" : "text-muted-foreground/60",
                            )}>
                              ETB/{item.measurementUnit || "m²"}
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {!isLoading && data.length > 0 && (
                <div className="mt-auto flex items-center justify-center gap-2 pt-8 pb-2 text-xs text-muted-foreground">
                  <span className="h-px w-8 bg-border" />
                  Showing {data.length} of {totalItems} products
                  <span className="h-px w-8 bg-border" />
                </div>
              )}
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1 shrink-0">
              <p className="text-xs text-muted-foreground">
                Page <span className="font-medium text-foreground">{currentPage}</span> of{" "}
                <span className="font-medium text-foreground">{totalPages}</span>
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
                        currentPage === 1 || isFetching
                          ? "pointer-events-none opacity-40"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      className={
                        currentPage === totalPages || isFetching
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

        {/* Transaction Panel */}
        <Card className="py-0 gap-0 lg:col-span-4 flex flex-col bg-card md:h-full md:overflow-hidden shadow-md border-primary/10">
          <CardHeader className="border-b bg-muted/30 shrink-0 py-3.5 gap-0">
            <CardTitle className="text-base flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </span>
              Transaction
            </CardTitle>
          </CardHeader>

          <CardContent className="md:flex-1 p-6 flex flex-col md:min-h-0">
            {selectedProduct ? (
              <div className="flex-1 flex flex-col min-h-0 space-y-6">
                {/* Selected product info */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/40 border shrink-0 animate-in fade-in duration-200">
                  <ProductImage
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="h-16 w-16 shrink-0 rounded-lg ring-1 ring-border"
                    iconSize="md"
                    sizes="64px"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedProduct.brand} &bull; {selectedProduct.size}{" "}
                      &bull; {selectedProduct.finish}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge
                        variant="outline"
                        className="bg-background text-[10px]"
                      >
                        Available: {selectedProduct.currentStock.toFixed(2)}{" "}
                        {unit}
                      </Badge>
                      {price !== null && (
                        <Badge variant="secondary" className="text-[10px]">
                          {price.toFixed(2)} / {unit}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quantity input */}
                <div className="flex-1 flex flex-col justify-center space-y-4">
                  <Label className="text-sm font-bold text-center block">
                    Quantity to Sell ({unit})
                  </Label>
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-full border-2 active:scale-95"
                      onClick={() => adjustAmount(-1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="relative group">
                      <Input
                        type="number"
                        step="0.01"
                        value={saleAmount || ""}
                        onChange={(e) =>
                          setSaleAmount(parseFloat(e.target.value) || 0)
                        }
                        className={cn(
                          "w-28 h-12 text-2xl font-bold text-center border-2 focus-visible:ring-0 rounded-xl",
                          saleAmount > selectedProduct.currentStock
                            ? "border-destructive text-destructive focus-visible:border-destructive"
                            : "border-primary",
                        )}
                      />
                      <span className="absolute -bottom-5 left-0 right-0 text-center text-[8px] text-muted-foreground font-bold tracking-widest uppercase">
                        {unit === "m²"
                          ? "Square Meters"
                          : unit === "m"
                            ? "Linear Meters"
                            : "Pieces"}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-full border-2 active:scale-95"
                      onClick={() => adjustAmount(1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 max-h-32 overflow-auto p-1">
                    {quickAdds.map((val) => (
                      <Button
                        key={val}
                        variant="secondary"
                        size="sm"
                        className="rounded-lg h-9 font-bold text-xs active:scale-95"
                        onClick={() => adjustAmount(val)}
                      >
                        +{val}
                      </Button>
                    ))}
                  </div>

                  {saleAmount > selectedProduct.currentStock && (
                    <p className="text-xs text-destructive text-center font-medium animate-in slide-in-from-bottom-1">
                      Exceeds available stock ({selectedProduct.currentStock.toFixed(2)} {unit})
                    </p>
                  )}

                  {/* Total line */}
                  {total !== null && saleAmount > 0 && saleAmount <= selectedProduct.currentStock && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-primary/5 border border-primary/10 animate-in fade-in duration-200">
                      <span className="text-xs text-muted-foreground font-medium">
                        Total
                      </span>
                      <span className="font-bold text-primary tabular-nums">
                        {total.toFixed(2)} ETB
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 shrink-0 pt-4 border-t mt-auto">
                  {status.type !== "idle" && (
                    <div
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl text-xs font-medium animate-in slide-in-from-bottom-2",
                        status.type === "success"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {status.type === "success" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      {status.message}
                    </div>
                  )}

                  <Button
                    className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-primary/20"
                    disabled={
                      saleAmount <= 0 ||
                      saleAmount > selectedProduct.currentStock ||
                      saleMutation.isPending
                    }
                    onClick={() => handleSale()}
                  >
                    {saleMutation.isPending ? "Processing..." : "Complete"}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setSelectedProduct(null)}
                    disabled={saleMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={ShoppingCart}
                  title="No product selected"
                  description="Select a product from the catalog to begin a sale."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
