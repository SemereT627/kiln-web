"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, Banknote, Landmark, HandCoins, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import { useUser } from "@/components/user-provider";
import { cn } from "@/lib/utils";

type PaymentMethod = "cash" | "bank_transfer" | "credit";

interface PendingOrder {
  id: string;
  sellerName: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: "paid" | "unpaid";
  total: number;
  items: { id: string }[];
  createdAt: string;
}

const PAYMENT_ICON: Record<PaymentMethod, React.ElementType> = {
  cash: Banknote,
  bank_transfer: Landmark,
  credit: HandCoins,
};

export function NotificationsBell({ className }: { className?: string }) {
  const user = useUser();
  const enabled = user?.role === "admin";
  useOrdersRealtime(enabled);
  const [open, setOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const { approveMutation, rejectMutation } = useOrderMutations();

  const { data: response } = useQuery({
    queryKey: ["orders", "pending", { page: 1, preview: true }],
    queryFn: async () => {
      const res = await fetch("/api/orders?status=pending&limit=5");
      if (!res.ok) throw new Error("Failed to fetch pending orders");
      return res.json();
    },
    enabled,
    refetchInterval: 60_000,
  });

  if (!enabled) return null;

  const orders: PendingOrder[] = response?.data || [];
  const total = response?.total ?? 0;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setRejectingId(null);
          setReason("");
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            total > 0
              ? `Notifications, ${total} pending order${total !== 1 ? "s" : ""}`
              : "Notifications"
          }
          className={cn("relative rounded-full", className)}
        >
          <Bell className="h-[18px] w-[18px]" />
          {total > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
            >
              {total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="w-90 rounded-2xl p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <p className="font-semibold text-sm">Pending Orders</p>
          {total > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {total} awaiting review
            </Badge>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto p-2 flex flex-col gap-1.5">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No orders awaiting approval.
            </p>
          ) : (
            orders.map((order) => {
              const PaymentIcon = PAYMENT_ICON[order.paymentMethod];
              const isRejecting = rejectingId === order.id;
              return (
                <div key={order.id} className="rounded-xl border p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <PaymentIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {order.sellerName || "Unknown seller"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
                        {order.total.toFixed(2)} ETB
                      </p>
                      {order.paymentMethod === "credit" && order.paymentStatus === "unpaid" && (
                        <Badge className="mt-1.5 text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 hover:bg-amber-100">
                          Payment not yet received
                        </Badge>
                      )}
                    </div>
                  </div>

                  {isRejecting ? (
                    <div className="mt-2.5 flex flex-col gap-2">
                      <Textarea
                        autoFocus
                        placeholder="Reason for rejecting (required)..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8"
                          onClick={() => {
                            setRejectingId(null);
                            setReason("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 h-8"
                          disabled={!reason.trim() || rejectMutation.isPending}
                          onClick={() =>
                            rejectMutation.mutate(
                              { orderId: order.id, reason: reason.trim() },
                              {
                                onSuccess: () => {
                                  setRejectingId(null);
                                  setReason("");
                                },
                              },
                            )
                          }
                        >
                          Confirm Reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-destructive hover:text-destructive"
                        onClick={() => setRejectingId(order.id)}
                        disabled={approveMutation.isPending}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-8"
                        onClick={() => approveMutation.mutate({ orderId: order.id })}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <Link
          href="/orders"
          onClick={() => setOpen(false)}
          className="block border-t px-4 py-2.5 text-center text-xs font-semibold text-primary hover:bg-muted/50 transition-colors"
        >
          View all orders
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
