"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  Landmark,
  HandCoins,
  ShieldAlert,
  Undo2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import { useUser } from "@/components/user-provider";

type OrderStatus = "pending" | "approved" | "rejected";
type FilterMode = OrderStatus | "unpaid_credit";

interface OrderItem {
  id: string;
  ceramicId: string;
  productName: string;
  productCode: string;
  quantity: number;
  priceAtSale: number;
  measurementUnit: string;
  returnedQuantity: number;
}

interface OrderReturn {
  id: string;
  notes: string | null;
  createdAt: string;
  createdByName: string | null;
  items: { id: string; orderItemId: string; quantity: number }[];
}

interface OrderReturnRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  sellerName: string | null;
  reviewedByName: string | null;
  items: { id: string; orderItemId: string; quantity: number }[];
}

interface Order {
  id: string;
  status: OrderStatus;
  paymentMethod: "cash" | "bank_transfer" | "credit";
  bankAccount: string | null;
  paymentStatus: "paid" | "unpaid";
  paidBy: string | null;
  paidAt: string | null;
  notes: string | null;
  sellerName: string | null;
  rejectionReason: string | null;
  createdAt: string;
  items: OrderItem[];
  total: number;
  returnedTotal: number;
  outstandingTotal: number;
  hasReturns: boolean;
  returns?: OrderReturn[];
  returnRequests?: OrderReturnRequest[];
  pendingReturnRequestCount?: number;
}

const STATUS_TABS: { label: string; value: FilterMode }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Unpaid Credit", value: "unpaid_credit" },
];

const PAYMENT_LABEL: Record<Order["paymentMethod"], string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  credit: "Pending / Credit",
};

const PAYMENT_ICON: Record<Order["paymentMethod"], React.ElementType> = {
  cash: Banknote,
  bank_transfer: Landmark,
  credit: HandCoins,
};

function renderOrderBadges(order: Order) {
  const badges: React.ReactNode[] = [];
  if (order.paymentMethod === "credit" && order.paymentStatus === "unpaid") {
    badges.push(
      <Badge
        key="unpaid"
        className="text-[10px] bg-warning/15 text-warning-foreground dark:text-warning hover:bg-warning/15"
      >
        Payment not yet received
      </Badge>,
    );
  }
  if (order.hasReturns) {
    badges.push(
      <Badge key="returns" variant="outline" className="text-[10px] gap-1">
        <Undo2 className="h-3 w-3" />
        Has returns
      </Badge>,
    );
  }
  if (order.pendingReturnRequestCount) {
    badges.push(
      <Badge
        key="return-requested"
        className="text-[10px] gap-1 bg-warning/15 text-warning-foreground dark:text-warning hover:bg-warning/15"
      >
        <Undo2 className="h-3 w-3" />
        Return requested
      </Badge>,
    );
  }
  if (order.status === "rejected") {
    badges.push(
      <Badge
        key="rejected"
        variant="outline"
        className="text-[10px] text-destructive"
      >
        Rejected
      </Badge>,
    );
  }
  return badges;
}

/** yyyy-mm-dd in local time — matches the <input type=date>-style format the
 * API's dateFrom/dateTo params expect, without UTC day-shift from toISOString. */
function toDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ordersUrl(
  filterMode: FilterMode,
  page: number,
  limit: number,
  dateFrom?: Date,
  dateTo?: Date,
) {
  const base =
    filterMode === "unpaid_credit"
      ? "/api/orders?status=approved&paymentMethod=credit&paymentStatus=unpaid"
      : `/api/orders?status=${filterMode}`;
  let url = `${base}&page=${page}&limit=${limit}`;
  if (dateFrom) url += `&dateFrom=${toDateParam(dateFrom)}`;
  if (dateTo) url += `&dateTo=${toDateParam(dateTo)}`;
  return url;
}

export default function OrdersPage() {
  const userProfile = useUser();
  const isAdmin = userProfile?.role === "admin";
  useOrdersRealtime(isAdmin);
  const [filterMode, setFilterMode] = useState<FilterMode>("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const changeFilterMode = (mode: FilterMode) => {
    setFilterMode(mode);
    setCurrentPage(1);
  };
  const changeDateRange = (range: {
    from: Date | undefined;
    to: Date | undefined;
  }) => {
    setDateFrom(range.from);
    setDateTo(range.to);
    setCurrentPage(1);
  };
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [returnQuantities, setReturnQuantities] = useState<
    Record<string, string>
  >({});
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [quantityEdits, setQuantityEdits] = useState<Record<string, string>>(
    {},
  );
  const [returnRequestQuantityEdits, setReturnRequestQuantityEdits] = useState<
    Record<string, string>
  >({});
  const [returnRequestRejectTarget, setReturnRequestRejectTarget] = useState<
    string | null
  >(null);
  const [returnRequestRejectReason, setReturnRequestRejectReason] =
    useState("");

  const { data: response, isLoading } = useQuery({
    queryKey: [
      "orders",
      filterMode,
      currentPage,
      dateFrom?.getTime(),
      dateTo?.getTime(),
    ],
    queryFn: async () => {
      const res = await fetch(
        ordersUrl(filterMode, currentPage, itemsPerPage, dateFrom, dateTo),
      );
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
  });

  // Per-tab counts for the segmented control's badges — cheap (limit=1,
  // Supabase still returns the exact total count regardless of page size).
  // Respects the active date filter so counts always match what each tab
  // would actually show if clicked.
  const { data: tabCounts } = useQuery({
    queryKey: ["orders", "tab-counts", dateFrom?.getTime(), dateTo?.getTime()],
    queryFn: async () => {
      const entries = await Promise.all(
        STATUS_TABS.map(async (tab) => {
          const res = await fetch(ordersUrl(tab.value, 1, 1, dateFrom, dateTo));
          if (!res.ok) throw new Error("Failed to fetch order counts");
          const json = await res.json();
          return [tab.value, json.total ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<FilterMode, number>;
    },
    enabled: isAdmin,
  });

  // Outstanding credit total is independent of the active tab, so admins can
  // see it at a glance regardless of what they're currently reviewing.
  const { data: outstandingResponse } = useQuery({
    queryKey: ["orders-outstanding-credit"],
    queryFn: async () => {
      const res = await fetch(
        "/api/orders?status=approved&paymentMethod=credit&paymentStatus=unpaid&limit=-1",
      );
      if (!res.ok) throw new Error("Failed to fetch outstanding credit");
      return res.json();
    },
    enabled: isAdmin,
  });

  const {
    approveMutation,
    rejectMutation,
    paymentStatusMutation,
    returnMutation,
    approveReturnRequestMutation,
    rejectReturnRequestMutation,
  } = useOrderMutations();

  const orders: Order[] = response?.data || [];
  const totalItems: number = response?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const outstandingOrders: Order[] = outstandingResponse?.data || [];
  const outstandingTotal = outstandingOrders.reduce(
    (sum, o) => sum + o.outstandingTotal,
    0,
  );

  const listOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  const { data: detailOrder } = useQuery({
    queryKey: ["order", selectedOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${selectedOrderId}`);
      if (!res.ok) throw new Error("Failed to fetch order");
      return res.json();
    },
    enabled: !!selectedOrderId,
  });

  const selectedOrder: Order | null = detailOrder ?? listOrder;

  const openOrder = (orderId: string) => {
    setPriceEdits({});
    setQuantityEdits({});
    setSelectedOrderId(orderId);
  };

  const closeSheet = () => {
    setSelectedOrderId(null);
    setReturnOpen(false);
    setReturnNotes("");
    setReturnQuantities({});
    setPriceEdits({});
    setQuantityEdits({});
    setReturnRequestQuantityEdits({});
    setReturnRequestRejectTarget(null);
    setReturnRequestRejectReason("");
  };

  const priceForItem = (item: OrderItem) => {
    const edit = priceEdits[item.id];
    return edit !== undefined && edit !== "" ? Number(edit) : item.priceAtSale;
  };

  const quantityForItem = (item: OrderItem) => {
    const edit = quantityEdits[item.id];
    return edit !== undefined && edit !== "" ? Number(edit) : item.quantity;
  };

  const pendingTotal = (selectedOrder?.items ?? []).reduce(
    (sum, item) =>
      sum +
      (quantityForItem(item) - item.returnedQuantity) * priceForItem(item),
    0,
  );

  const approveSelectedOrder = () => {
    if (!selectedOrder) return;
    const overrides = selectedOrder.items
      .map((item) => {
        const priceEdit = priceEdits[item.id];
        const quantityEdit = quantityEdits[item.id];
        const override: {
          orderItemId: string;
          priceAtSale?: number;
          quantity?: number;
        } = {
          orderItemId: item.id,
        };
        if (
          priceEdit !== undefined &&
          priceEdit !== "" &&
          Number(priceEdit) !== item.priceAtSale
        ) {
          override.priceAtSale = Number(priceEdit);
        }
        if (
          quantityEdit !== undefined &&
          quantityEdit !== "" &&
          Number(quantityEdit) !== item.quantity
        ) {
          override.quantity = Number(quantityEdit);
        }
        return override;
      })
      .filter((o) => o.priceAtSale !== undefined || o.quantity !== undefined);

    approveMutation.mutate(
      { orderId: selectedOrder.id, overrides },
      { onSuccess: () => closeSheet() },
    );
  };

  const openReturnDialog = () => {
    setReturnQuantities({});
    setReturnNotes("");
    setReturnOpen(true);
  };

  const submitReturn = () => {
    if (!selectedOrder) return;
    const items = Object.entries(returnQuantities)
      .map(([orderItemId, qty]) => ({ orderItemId, quantity: Number(qty) }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) return;
    returnMutation.mutate(
      {
        orderId: selectedOrder.id,
        items,
        notes: returnNotes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setReturnOpen(false);
          setReturnNotes("");
          setReturnQuantities({});
        },
      },
    );
  };

  const approveReturnRequest = (rr: OrderReturnRequest) => {
    if (!selectedOrder) return;
    const overrides = rr.items
      .map((item) => {
        const edit = returnRequestQuantityEdits[item.id];
        const quantity =
          edit !== undefined && edit !== "" && Number(edit) !== item.quantity
            ? Number(edit)
            : undefined;
        return { returnRequestItemId: item.id, quantity };
      })
      .filter((o) => o.quantity !== undefined);

    approveReturnRequestMutation.mutate({
      orderId: selectedOrder.id,
      requestId: rr.id,
      overrides,
    });
  };

  const submitReturnRequestRejection = () => {
    if (
      !selectedOrder ||
      !returnRequestRejectTarget ||
      !returnRequestRejectReason.trim()
    )
      return;
    rejectReturnRequestMutation.mutate(
      {
        orderId: selectedOrder.id,
        requestId: returnRequestRejectTarget,
        reason: returnRequestRejectReason.trim(),
      },
      {
        onSuccess: () => {
          setReturnRequestRejectTarget(null);
          setReturnRequestRejectReason("");
        },
      },
    );
  };

  if (userProfile && !isAdmin) {
    return (
      <div className="flex h-full items-center justify-center animate-in fade-in duration-500">
        <EmptyState
          icon={ShieldAlert}
          variant="warning"
          title="Access Restricted"
          description="Only administrators can review and approve orders."
          action={
            <Button asChild variant="outline" size="sm">
              <a href="/dashboard">Return to Dashboard</a>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in duration-500 overflow-hidden">
      <div className="shrink-0">
        <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
          Sales
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl mt-0.5">
          Order Approvals
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Review orders submitted by sellers before stock is deducted and a sale
          is recorded.
        </p>
      </div>

      <Card className="border-warning/30 bg-warning/5 shrink-0">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
            <Wallet className="h-5 w-5 text-warning-foreground dark:text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Outstanding Credit
            </p>
            <p className="text-xl font-bold tabular-nums">
              {outstandingTotal.toFixed(2)} ETB
            </p>
          </div>
          <p className="text-xs text-muted-foreground shrink-0">
            {outstandingOrders.length} unpaid order
            {outstandingOrders.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="inline-flex gap-1 rounded-lg border bg-muted/30 p-1 overflow-x-auto no-scrollbar -mx-1 px-1 sm:mx-0">
          {STATUS_TABS.map((tab) => {
            const active = filterMode === tab.value;
            const count = tabCounts?.[tab.value];
            return (
              <button
                key={tab.value}
                onClick={() => changeFilterMode(tab.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onChange={changeDateRange}
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0 gap-3">
        <div className="flex-1 flex flex-col overflow-hidden rounded-lg border">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-auto">
              <Table className="min-w-175">
                <TableHeader className="border-b">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Seller
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Items
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Payment
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="text-right sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Amount
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-background text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow
                        key={i}
                        className="hover:bg-transparent h-[60px]"
                      >
                        <TableCell className="pl-4">
                          <Skeleton className="h-3.5 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3.5 w-12" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3.5 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3.5 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3.5 w-16 ml-auto" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : orders.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6}>
                        <EmptyState
                          icon={ClipboardCheck}
                          title="No orders here"
                          description="There are no orders matching this filter right now."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => {
                      const PaymentIcon = PAYMENT_ICON[order.paymentMethod];
                      const badges = renderOrderBadges(order);
                      return (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer border-b transition-colors hover:bg-muted/40 h-[60px]"
                          onClick={() => openOrder(order.id)}
                        >
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <PaymentIcon className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-semibold text-sm truncate">
                                {order.sellerName || "Unknown seller"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {order.items.length}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {PAYMENT_LABEL[order.paymentMethod]}
                              {order.bankAccount
                                ? ` · ${order.bankAccount}`
                                : ""}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {new Date(order.createdAt).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm font-bold tabular-nums">
                              {order.outstandingTotal.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40 ml-0.5">
                              ETB
                            </span>
                          </TableCell>
                          <TableCell>
                            {badges.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {badges}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 shrink-0">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {Math.min(currentPage * itemsPerPage, totalItems)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{totalItems}</span>{" "}
              orders
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

      <Sheet
        open={!!selectedOrderId}
        onOpenChange={(open) => !open && closeSheet()}
      >
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-md overflow-y-auto">
          {selectedOrder && (
            <>
              <SheetHeader>
                <SheetTitle>
                  Order from {selectedOrder.sellerName || "Unknown seller"}
                </SheetTitle>
                <SheetDescription>
                  Submitted {new Date(selectedOrder.createdAt).toLocaleString()}
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {PAYMENT_LABEL[selectedOrder.paymentMethod]}
                  </Badge>
                  {selectedOrder.bankAccount && (
                    <Badge variant="outline">{selectedOrder.bankAccount}</Badge>
                  )}
                  {selectedOrder.paymentMethod === "credit" && (
                    <Badge
                      className={cn(
                        "text-[10px]",
                        selectedOrder.paymentStatus === "unpaid"
                          ? "bg-warning/15 text-warning-foreground dark:text-warning hover:bg-warning/15"
                          : "bg-success/15 text-success hover:bg-success/15",
                      )}
                    >
                      {selectedOrder.paymentStatus === "unpaid"
                        ? "Payment not yet received"
                        : "Paid"}
                    </Badge>
                  )}
                </div>

                {selectedOrder.notes && (
                  <p className="text-sm text-muted-foreground rounded-lg bg-muted/40 p-3">
                    {selectedOrder.notes}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {selectedOrder.items.map((item) => {
                    const isPending = selectedOrder.status === "pending";
                    const remaining = isPending
                      ? quantityForItem(item) - item.returnedQuantity
                      : item.quantity - item.returnedQuantity;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.productCode}
                          </p>
                          {item.returnedQuantity > 0 && (
                            <p className="text-[10px] text-warning-foreground dark:text-warning mt-0.5">
                              {item.returnedQuantity} {item.measurementUnit}{" "}
                              returned
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                className="w-20 h-9 text-right text-sm tabular-nums"
                                value={
                                  quantityEdits[item.id] ??
                                  String(item.quantity)
                                }
                                onChange={(e) =>
                                  setQuantityEdits((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                              />
                              <span className="text-xs text-muted-foreground">
                                {item.measurementUnit}
                              </span>
                            </div>
                          ) : (
                            <p className="font-semibold tabular-nums">
                              {remaining} {item.measurementUnit}
                            </p>
                          )}
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                className="w-24 h-9 text-right text-sm tabular-nums"
                                value={
                                  priceEdits[item.id] ??
                                  String(item.priceAtSale)
                                }
                                onChange={(e) =>
                                  setPriceEdits((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                              />
                              <span className="text-xs text-muted-foreground">
                                ETB
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {(remaining * item.priceAtSale).toFixed(2)} ETB
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {selectedOrder.hasReturns ? "Outstanding total" : "Total"}
                  </span>
                  <span className="font-bold text-lg tabular-nums">
                    {(selectedOrder.status === "pending"
                      ? pendingTotal
                      : selectedOrder.outstandingTotal
                    ).toFixed(2)}{" "}
                    ETB
                  </span>
                </div>

                {selectedOrder.returnRequests
                  ?.filter((rr) => rr.status === "pending")
                  .map((rr) => (
                    <div
                      key={rr.id}
                      className="flex flex-col gap-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-warning-foreground dark:text-warning">
                          Return requested
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(rr.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {rr.sellerName && (
                        <p className="text-xs text-muted-foreground -mt-1.5">
                          Requested by {rr.sellerName}
                        </p>
                      )}
                      <div className="flex flex-col gap-1.5">
                        {rr.items.map((item) => {
                          const orderItem = selectedOrder.items.find(
                            (i) => i.id === item.orderItemId,
                          );
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span className="truncate">
                                {orderItem?.productName ?? "Unknown item"}
                              </span>
                              <Input
                                type="number"
                                min={0.01}
                                step="any"
                                className="h-9 w-24 text-right"
                                value={
                                  returnRequestQuantityEdits[item.id] ??
                                  String(item.quantity)
                                }
                                onChange={(e) =>
                                  setReturnRequestQuantityEdits((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                      {rr.notes && <p className="text-xs">{rr.notes}</p>}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive hover:text-destructive"
                          disabled={
                            approveReturnRequestMutation.isPending ||
                            rejectReturnRequestMutation.isPending
                          }
                          onClick={() => setReturnRequestRejectTarget(rr.id)}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={
                            approveReturnRequestMutation.isPending ||
                            rejectReturnRequestMutation.isPending
                          }
                          onClick={() => approveReturnRequest(rr)}
                        >
                          {approveReturnRequestMutation.isPending
                            ? "Approving..."
                            : "Approve"}
                        </Button>
                      </div>
                    </div>
                  ))}

                {selectedOrder.returns && selectedOrder.returns.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Return history
                    </p>
                    {selectedOrder.returns.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg bg-muted/40 p-3 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium">
                            {r.items.reduce((s, i) => s + i.quantity, 0)}{" "}
                            item(s) returned
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(r.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {r.createdByName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Recorded by {r.createdByName}
                          </p>
                        )}
                        {r.notes && <p className="text-xs mt-1">{r.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {selectedOrder.status === "rejected" &&
                  selectedOrder.rejectionReason && (
                    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      {selectedOrder.rejectionReason}
                    </div>
                  )}

                {selectedOrder.status === "approved" && (
                  <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Approved — stock deducted and sale recorded.
                  </div>
                )}

                {selectedOrder.status === "pending" && (
                  <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning-foreground dark:text-warning">
                    <Clock className="h-4 w-4 shrink-0" />
                    Awaiting your review.
                  </div>
                )}
              </div>

              {selectedOrder.status === "pending" && (
                <SheetFooter className="flex-row gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => setRejectOpen(true)}
                    disabled={
                      approveMutation.isPending || rejectMutation.isPending
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={approveSelectedOrder}
                    disabled={
                      approveMutation.isPending || rejectMutation.isPending
                    }
                  >
                    {approveMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                </SheetFooter>
              )}

              {selectedOrder.status === "approved" && (
                <SheetFooter className="flex-row gap-2 flex-wrap">
                  {selectedOrder.paymentMethod === "credit" && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={paymentStatusMutation.isPending}
                      onClick={() =>
                        paymentStatusMutation.mutate({
                          orderId: selectedOrder.id,
                          paymentStatus:
                            selectedOrder.paymentStatus === "paid"
                              ? "unpaid"
                              : "paid",
                        })
                      }
                    >
                      {selectedOrder.paymentStatus === "paid"
                        ? "Mark as Unpaid"
                        : "Mark as Paid"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={selectedOrder.items.every(
                      (i) => i.quantity - i.returnedQuantity <= 0,
                    )}
                    onClick={openReturnDialog}
                  >
                    Record Return
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) setRejectReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this order?</DialogTitle>
            <DialogDescription>
              No stock will be deducted and no sale will be recorded. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejecting (required)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => {
                if (!selectedOrder || !rejectReason.trim()) return;
                rejectMutation.mutate(
                  { orderId: selectedOrder.id, reason: rejectReason.trim() },
                  {
                    onSuccess: () => {
                      closeSheet();
                      setRejectOpen(false);
                      setRejectReason("");
                    },
                  },
                );
              }}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!returnRequestRejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setReturnRequestRejectTarget(null);
            setReturnRequestRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this return request?</DialogTitle>
            <DialogDescription>
              The seller will see this reason. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejecting (required)..."
            value={returnRequestRejectReason}
            onChange={(e) => setReturnRequestRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturnRequestRejectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                !returnRequestRejectReason.trim() ||
                rejectReturnRequestMutation.isPending
              }
              onClick={submitReturnRequestRejection}
            >
              {rejectReturnRequestMutation.isPending
                ? "Rejecting..."
                : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a return</DialogTitle>
            <DialogDescription>
              Enter the quantity returned for each item. Stock is restored
              immediately; sale history is kept intact.
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="flex flex-col gap-3">
              {selectedOrder.items.map((item) => {
                const remaining = item.quantity - item.returnedQuantity;
                if (remaining <= 0) return null;
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {remaining} {item.measurementUnit} returnable
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      step="any"
                      className="w-24"
                      placeholder="0"
                      value={returnQuantities[item.id] ?? ""}
                      onChange={(e) =>
                        setReturnQuantities((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                );
              })}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="return-notes">Notes (optional)</Label>
                <Textarea
                  id="return-notes"
                  placeholder="e.g. defective, wrong item..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                returnMutation.isPending ||
                Object.values(returnQuantities).every(
                  (v) => !v || Number(v) <= 0,
                )
              }
              onClick={submitReturn}
            >
              {returnMutation.isPending ? "Recording..." : "Record Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
