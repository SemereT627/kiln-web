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
  Trash2,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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

interface CartLine {
  ceramicId: string;
  name: string;
  brand: string;
  size: string;
  imageUrl?: string | null;
  measurementUnit: string;
  quantity: number;
  priceAtSale: number;
  stock: number;
  error?: string;
}

interface CheckoutResult {
  ceramicId: string;
  success: boolean;
  error?: string;
}

export default function SalesPage() {
  const userProfile = useUser();
  const isAdmin = userProfile?.role === "admin";

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [dialogProduct, setDialogProduct] = useState<any>(null);
  const [dialogAmount, setDialogAmount] = useState<number>(0);
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({
    type: "idle",
    message: "",
  });

  const {
    data: response,
    isLoading,
    isFetching,
  } = useQuery({
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

  const checkoutMutation = useMutation({
    mutationFn: async (
      items: { ceramicId: string; quantity: number; priceAtSale: number }[],
    ) => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to complete sale");
      return json.results as CheckoutResult[];
    },
    onSuccess: (results) => {
      const failedByCeramic = new Map(
        results.filter((r) => !r.success).map((r) => [r.ceramicId, r.error]),
      );
      const succeededIds = new Set(
        results.filter((r) => r.success).map((r) => r.ceramicId),
      );

      setCart((prev) =>
        prev
          .filter((line) => !succeededIds.has(line.ceramicId))
          .map((line) =>
            failedByCeramic.has(line.ceramicId)
              ? { ...line, error: failedByCeramic.get(line.ceramicId) }
              : line,
          ),
      );

      const successCount = succeededIds.size;
      const failCount = results.length - successCount;
      setStatus({
        type: failCount > 0 ? "error" : "success",
        message:
          failCount > 0
            ? `${successCount} item${successCount !== 1 ? "s" : ""} sold, ${failCount} failed — see details below.`
            : `${successCount} item${successCount !== 1 ? "s" : ""} sold successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["ceramics"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });

      if (failCount === 0) {
        setCartSheetOpen(false);
        setTimeout(() => setStatus({ type: "idle", message: "" }), 3000);
      }
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
          <a href="/dashboard">Return to Dashboard</a>
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

  const existingCartQtyFor = (ceramicId: string) =>
    cart.find((l) => l.ceramicId === ceramicId)?.quantity ?? 0;

  const dialogUnit = dialogProduct?.measurementUnit || "m²";
  const dialogQuickAdds =
    dialogUnit === "m²" ? [1, 5, 10, 20, 50, 100] : [1, 2, 5, 10, 20, 50];
  const dialogAlreadyInCart = dialogProduct
    ? existingCartQtyFor(dialogProduct._id)
    : 0;
  const dialogRemainingStock = dialogProduct
    ? dialogProduct.currentStock - dialogAlreadyInCart
    : 0;
  const dialogExceedsStock = dialogAmount > dialogRemainingStock;

  const openProductDialog = (item: any) => {
    setDialogProduct(item);
    setDialogAmount(0);
  };

  const closeProductDialog = () => {
    setDialogProduct(null);
    setDialogAmount(0);
  };

  const adjustDialogAmount = (val: number) => {
    setDialogAmount((prev) => Math.max(0, parseFloat((prev + val).toFixed(2))));
  };

  const addDialogToCart = () => {
    if (!dialogProduct || dialogAmount <= 0 || dialogExceedsStock) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.ceramicId === dialogProduct._id);
      if (existing) {
        return prev.map((l) =>
          l.ceramicId === dialogProduct._id
            ? {
                ...l,
                quantity: parseFloat((l.quantity + dialogAmount).toFixed(2)),
                error: undefined,
              }
            : l,
        );
      }
      return [
        ...prev,
        {
          ceramicId: dialogProduct._id,
          name: dialogProduct.name,
          brand: dialogProduct.brand,
          size: dialogProduct.size,
          imageUrl: dialogProduct.imageUrl,
          measurementUnit: dialogProduct.measurementUnit || "m²",
          quantity: dialogAmount,
          priceAtSale: dialogProduct.pricePerUnit ?? 0,
          stock: dialogProduct.currentStock,
        },
      ];
    });
    closeProductDialog();
  };

  const updateCartQty = (ceramicId: string, qty: number) => {
    setCart((prev) =>
      prev.map((l) =>
        l.ceramicId === ceramicId
          ? { ...l, quantity: Math.max(0, qty), error: undefined }
          : l,
      ),
    );
  };

  const updateCartPrice = (ceramicId: string, price: number) => {
    setCart((prev) =>
      prev.map((l) =>
        l.ceramicId === ceramicId
          ? { ...l, priceAtSale: Math.max(0, price) }
          : l,
      ),
    );
  };

  const removeCartLine = (ceramicId: string) => {
    setCart((prev) => prev.filter((l) => l.ceramicId !== ceramicId));
  };

  const cartTotal = cart.reduce(
    (sum, l) => sum + l.quantity * l.priceAtSale,
    0,
  );
  const cartHasIssues = cart.some(
    (l) => l.quantity <= 0 || l.quantity > l.stock,
  );

  const handleCheckout = () => {
    if (cart.length === 0 || cartHasIssues || checkoutMutation.isPending)
      return;
    checkoutMutation.mutate(
      cart.map((l) => ({
        ceramicId: l.ceramicId,
        quantity: l.quantity,
        priceAtSale: l.priceAtSale,
      })),
    );
  };

  return (
    <div className="flex flex-col gap-6 pr-1 h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
            Point of Sale
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
            Sales
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Select products to add them to the transaction.
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

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-2">
        {/* Product Catalog */}
        <div
          className={cn(
            "lg:col-span-8 flex flex-col min-h-0 gap-4",
            cart.length > 0 && "pb-20 lg:pb-0",
          )}
        >
          <Card className="py-0 gap-0 flex-1 flex flex-col overflow-hidden hover:shadow-xs shadow-xs">
            <CardHeader className="py-3.5 px-5 shrink-0 border-b bg-muted/30 gap-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Product Catalog</CardTitle>
                <Badge variant="outline" className="font-normal">
                  {totalItems} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 flex flex-col">
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
                    const inCartQty = existingCartQtyFor(item._id);
                    const isOutOfStock = item.currentStock <= 0;
                    const isLow = !isOutOfStock && item.currentStock <= 5;
                    const isInCart = inCartQty > 0;
                    return (
                      <button
                        type="button"
                        key={item._id}
                        disabled={isOutOfStock}
                        onClick={() => {
                          if (isOutOfStock) return;
                          openProductDialog(item);
                        }}
                        className={cn(
                          "group relative flex text-left rounded-xl border transition-all duration-150 p-3 gap-3 items-center",
                          isOutOfStock
                            ? "opacity-40 cursor-not-allowed bg-muted border-transparent"
                            : isInCart
                              ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20 shadow-xs cursor-pointer active:scale-[0.98]"
                              : "bg-card border-border hover:border-primary/40 hover:shadow-md shadow-xs cursor-pointer active:scale-[0.98]",
                        )}
                      >
                        {isInCart && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow">
                            {inCartQty}
                          </span>
                        )}
                        <ProductImage
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-border"
                          iconSize="sm"
                          sizes="48px"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate text-sm leading-tight text-foreground">
                            {item.name}
                          </p>
                          <p className="text-[10px] uppercase tracking-wide font-medium mt-0.5 text-muted-foreground">
                            {item.brand} · {item.size}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {isOutOfStock ? (
                              <span className="text-[11px] font-semibold text-destructive">
                                Out of Stock
                              </span>
                            ) : (
                              <>
                                <span className="text-[11px] font-bold tabular-nums text-foreground">
                                  {item.currentStock.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {item.measurementUnit || "m²"}
                                </span>
                                {isLow && (
                                  <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                                    Low
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {item.pricePerUnit != null && (
                          <div className="shrink-0 text-right">
                            <p className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                              {Number(item.pricePerUnit).toFixed(0)}
                            </p>
                            <p className="text-[9px] uppercase text-muted-foreground/60">
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
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 shrink-0">
              <p className="text-xs text-muted-foreground">
                Page{" "}
                <span className="font-medium text-foreground">
                  {currentPage}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {totalPages}
                </span>
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

        {/* Transaction Panel — persistent sidebar on desktop */}
        <Card className="py-0 gap-0 hidden lg:flex lg:col-span-4 flex-col bg-card h-full overflow-hidden shadow-md border-primary/10">
          <CardHeader className="border-b bg-muted/30 shrink-0 py-3.5 gap-0">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </span>
                Transaction
              </span>
              {cart.length > 0 && (
                <Badge variant="outline" className="font-normal">
                  {cart.length} item{cart.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 p-4 flex flex-col min-h-0">
            <CartPanelBody
              cart={cart}
              cartTotal={cartTotal}
              cartHasIssues={cartHasIssues}
              status={status}
              pending={checkoutMutation.isPending}
              onQtyChange={updateCartQty}
              onPriceChange={updateCartPrice}
              onRemove={removeCartLine}
              onCheckout={handleCheckout}
            />
          </CardContent>
        </Card>
      </div>

      {/* Floating transaction bar — below lg, mirrors the tylio-mobile cart bar */}
      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => setCartSheetOpen(true)}
          className="lg:hidden fixed bottom-4 left-4 right-4 z-30 flex items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-primary-foreground shadow-lg shadow-primary/30 animate-in slide-in-from-bottom-4"
        >
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
            {cart.length}
          </span>
          <span className="flex-1 text-left font-bold tabular-nums">
            {cartTotal.toFixed(2)} ETB
          </span>
          <span className="flex items-center gap-1 font-bold text-sm">
            Review
            <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      )}

      {/* Transaction review sheet — below lg */}
      <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
        <SheetContent className="sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 shrink-0">
            <SheetTitle className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </span>
              Transaction
            </SheetTitle>
            <SheetDescription>
              {cart.length} item{cart.length !== 1 ? "s" : ""} in this sale.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 p-4 flex flex-col min-h-0">
            <CartPanelBody
              cart={cart}
              cartTotal={cartTotal}
              cartHasIssues={cartHasIssues}
              status={status}
              pending={checkoutMutation.isPending}
              onQtyChange={updateCartQty}
              onPriceChange={updateCartPrice}
              onRemove={removeCartLine}
              onCheckout={handleCheckout}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Add-to-cart quantity dialog */}
      <Dialog
        open={!!dialogProduct}
        onOpenChange={(open) => !open && closeProductDialog()}
      >
        <DialogContent>
          {dialogProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{dialogProduct.name}</DialogTitle>
                <DialogDescription>
                  {dialogProduct.brand} &bull; {dialogProduct.size} &bull;
                  Stock: {dialogProduct.currentStock.toFixed(2)} {dialogUnit}
                  {dialogAlreadyInCart > 0 &&
                    ` (${dialogAlreadyInCart} already in cart)`}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col items-center gap-4 py-2">
                <Label className="text-sm font-bold text-center block">
                  Quantity to Sell ({dialogUnit})
                </Label>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full border-2 active:scale-95"
                    onClick={() => adjustDialogAmount(-1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    step="0.01"
                    value={dialogAmount || ""}
                    onChange={(e) =>
                      setDialogAmount(parseFloat(e.target.value) || 0)
                    }
                    className={cn(
                      "w-28 h-12 text-2xl font-bold text-center border-2 focus-visible:ring-0 rounded-xl",
                      dialogExceedsStock
                        ? "border-destructive text-destructive focus-visible:border-destructive"
                        : "border-primary",
                    )}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full border-2 active:scale-95"
                    onClick={() => adjustDialogAmount(1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 w-full">
                  {dialogQuickAdds.map((val) => (
                    <Button
                      key={val}
                      variant="secondary"
                      size="sm"
                      className="rounded-lg h-9 font-bold text-xs active:scale-95"
                      onClick={() => adjustDialogAmount(val)}
                    >
                      +{val}
                    </Button>
                  ))}
                </div>

                {dialogExceedsStock && (
                  <p className="text-xs text-destructive text-center font-medium">
                    Exceeds available stock ({dialogRemainingStock.toFixed(2)}{" "}
                    {dialogUnit} remaining)
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeProductDialog}>
                  Cancel
                </Button>
                <Button
                  disabled={dialogAmount <= 0 || dialogExceedsStock}
                  onClick={addDialogToCart}
                >
                  Add to Cart
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CartPanelBody({
  cart,
  cartTotal,
  cartHasIssues,
  status,
  pending,
  onQtyChange,
  onPriceChange,
  onRemove,
  onCheckout,
}: {
  cart: CartLine[];
  cartTotal: number;
  cartHasIssues: boolean;
  status: { type: "idle" | "success" | "error"; message: string };
  pending: boolean;
  onQtyChange: (ceramicId: string, qty: number) => void;
  onPriceChange: (ceramicId: string, price: number) => void;
  onRemove: (ceramicId: string) => void;
  onCheckout: () => void;
}) {
  if (cart.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={ShoppingCart}
          title="Cart is empty"
          description="Select products from the catalog to add them here."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-auto flex flex-col gap-2 -mx-1 px-1">
        {cart.map((line) => (
          <CartLineItem
            key={line.ceramicId}
            line={line}
            onQtyChange={(qty) => onQtyChange(line.ceramicId, qty)}
            onPriceChange={(price) => onPriceChange(line.ceramicId, price)}
            onRemove={() => onRemove(line.ceramicId)}
          />
        ))}
      </div>

      <div className="shrink-0 pt-4 border-t mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            Total ({cart.length} item{cart.length !== 1 ? "s" : ""})
          </span>
          <span className="font-bold text-lg tabular-nums text-primary">
            {cartTotal.toFixed(2)} ETB
          </span>
        </div>

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
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {status.message}
          </div>
        )}

        <Button
          className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-primary/20"
          disabled={cartHasIssues || pending}
          onClick={onCheckout}
        >
          {pending ? "Processing..." : "Complete Sale"}
        </Button>
      </div>
    </div>
  );
}

function CartLineItem({
  line,
  onQtyChange,
  onPriceChange,
  onRemove,
}: {
  line: CartLine;
  onQtyChange: (qty: number) => void;
  onPriceChange: (price: number) => void;
  onRemove: () => void;
}) {
  const exceedsStock = line.quantity > line.stock;

  return (
    <div className="flex items-start gap-3 rounded-xl border p-3 animate-in fade-in duration-200">
      <ProductImage
        src={line.imageUrl}
        alt={line.name}
        className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-border"
        iconSize="sm"
        sizes="48px"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{line.name}</p>
        <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
          {line.brand} · {line.size}
        </p>

        <div className="flex items-center gap-1.5 mt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 rounded-full shrink-0"
            onClick={() =>
              onQtyChange(parseFloat((line.quantity - 1).toFixed(2)))
            }
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            step="0.01"
            value={line.quantity}
            onChange={(e) => onQtyChange(parseFloat(e.target.value) || 0)}
            className="w-16 h-6 text-center text-xs px-1 tabular-nums"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 rounded-full shrink-0"
            onClick={() =>
              onQtyChange(parseFloat((line.quantity + 1).toFixed(2)))
            }
          >
            <Plus className="h-3 w-3" />
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {line.measurementUnit}
          </span>
        </div>

        {exceedsStock && (
          <p className="text-[10px] text-destructive mt-1">
            Exceeds stock ({line.stock.toFixed(2)} {line.measurementUnit})
          </p>
        )}
        {line.error && (
          <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {line.error}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step="0.01"
            value={line.priceAtSale}
            onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)}
            className="w-16 h-6 text-right text-[10px] px-1 tabular-nums"
          />
          <span className="text-[9px] text-muted-foreground">ETB</span>
        </div>
        <p className="text-xs font-bold tabular-nums">
          {(line.quantity * line.priceAtSale).toFixed(2)}
        </p>
      </div>
    </div>
  );
}
