"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { StockBadge } from "@/components/stock-badge";
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
      <div className="flex h-full items-center justify-center animate-in fade-in duration-500">
        <EmptyState
          icon={ShieldAlert}
          variant="warning"
          title="Access Restricted"
          description="Only administrators are authorized to record sales transactions. If you need to log a sale, please contact the store owner."
          action={
            <Button asChild variant="outline" size="sm">
              <a href="/dashboard">Return to Dashboard</a>
            </Button>
          }
        />
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
      <div className="shrink-0">
        <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
          Sales
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
          New Sale
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Select products to add them to the transaction.
        </p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-2">
        {/* Product Catalog — takes the full width until something's in the
            cart, so the Transaction panel doesn't reserve empty space up front. */}
        <div
          className={cn(
            "flex flex-col min-h-0 gap-4",
            cart.length > 0 ? "lg:col-span-8" : "lg:col-span-12",
            cart.length > 0 && "pb-20 lg:pb-0",
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h2 className="text-base font-semibold">Products</h2>
              <Badge variant="outline" className="font-normal shrink-0">
                {totalItems} items
              </Badge>
            </div>
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or brand..."
                className="pl-10 h-9 rounded-xl"
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

          <div
            className={cn(
              "flex-1 min-h-0 flex flex-col rounded-lg border overflow-hidden transition-opacity duration-200",
              isFetching && !isLoading && "opacity-50 pointer-events-none",
            )}
          >
            {isLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: skeletonCount }).map((_, i) => (
                  <Skeleton key={i} className="rounded-lg h-14" />
                ))}
              </div>
            ) : data.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products found"
                description="Try a different search term."
              />
            ) : (
              <Table containerClassName="flex-1 min-h-0 overflow-auto">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky top-0 z-10 bg-background pl-4">
                      Product
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background">
                      Brand · Size
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background text-right">
                      Stock
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background text-right pr-4">
                      Price
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item: any) => {
                    const inCartQty = existingCartQtyFor(item._id);
                    const isOutOfStock = item.currentStock <= 0;
                    const isLow = !isOutOfStock && item.currentStock <= 5;
                    const isInCart = inCartQty > 0;
                    return (
                      <TableRow
                        key={item._id}
                        onClick={() => {
                          if (isOutOfStock) return;
                          openProductDialog(item);
                        }}
                        className={cn(
                          "transition-colors",
                          isOutOfStock
                            ? "opacity-40 cursor-not-allowed"
                            : isInCart
                              ? "bg-primary/5 hover:bg-primary/10 cursor-pointer"
                              : "cursor-pointer hover:bg-muted/40",
                        )}
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <ProductImage
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-border"
                              iconSize="sm"
                              sizes="40px"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm truncate">
                                  {item.name}
                                </p>
                                {isInCart && (
                                  <Badge className="shrink-0 bg-primary text-primary-foreground hover:bg-primary">
                                    {inCartQty} in cart
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                {item.productId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.brand} · {item.size}
                        </TableCell>
                        <TableCell className="text-right">
                          {isOutOfStock ? (
                            <StockBadge stock={item.currentStock} size="sm" />
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-sm font-bold tabular-nums text-foreground">
                                {item.currentStock.toFixed(2)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {item.measurementUnit || "m²"}
                              </span>
                              {isLow && (
                                <StockBadge
                                  stock={item.currentStock}
                                  size="sm"
                                />
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          {item.pricePerUnit != null ? (
                            <>
                              <span className="text-sm font-semibold tabular-nums text-foreground">
                                {Number(item.pricePerUnit).toFixed(0)}
                              </span>
                              <span className="text-[11px] text-muted-foreground ml-1">
                                ETB/{item.measurementUnit || "m²"}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

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

        {/* Transaction Panel — only takes up space once there's something to
            check out, sliding in from the right instead of sitting empty. */}
        {cart.length > 0 && (
          <div className="hidden lg:col-span-4 lg:flex flex-col min-h-0 animate-in slide-in-from-right-8 fade-in duration-300">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <span className="flex items-center gap-2.5 text-base font-semibold">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </span>
                Transaction
              </span>
              <Badge variant="outline" className="font-normal">
                {cart.length} item{cart.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="flex-1 pt-4 flex flex-col min-h-0">
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
          </div>
        )}
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
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-md flex flex-col gap-0 p-0">
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
                ? "bg-success/10 text-success"
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
    <div className="flex flex-col gap-3 rounded-xl border p-3 animate-in fade-in duration-200">
      {/* Top row: identity, full width for name/brand + a remove action */}
      <div className="flex items-start gap-3">
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
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Bottom row: quantity stepper and price/total each get their own
          half instead of cramming into the identity row's leftover width. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full shrink-0"
            onClick={() =>
              onQtyChange(parseFloat((line.quantity - 1).toFixed(2)))
            }
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Input
            type="number"
            step="0.01"
            value={line.quantity}
            onChange={(e) => onQtyChange(parseFloat(e.target.value) || 0)}
            className="w-16 h-9 shrink-0 text-center text-sm px-1 tabular-nums"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full shrink-0"
            onClick={() =>
              onQtyChange(parseFloat((line.quantity + 1).toFixed(2)))
            }
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {line.measurementUnit}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              step="0.01"
              value={line.priceAtSale}
              onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)}
              className="w-16 h-8 text-right text-xs px-1 tabular-nums"
            />
            <span className="text-[9px] text-muted-foreground">ETB</span>
          </div>
          <p className="text-xs font-bold tabular-nums">
            {(line.quantity * line.priceAtSale).toFixed(2)}
          </p>
        </div>
      </div>

      {exceedsStock && (
        <p className="text-[10px] text-destructive -mt-1">
          Exceeds stock ({line.stock.toFixed(2)} {line.measurementUnit})
        </p>
      )}
      {line.error && (
        <p className="text-[10px] text-destructive -mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {line.error}
        </p>
      )}
    </div>
  );
}
