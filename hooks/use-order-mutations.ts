"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Shared approve/reject mutations for orders — used by both the full
 * Order Approvals page and the notifications bell's quick-action panel. */
export function useOrderMutations() {
  const queryClient = useQueryClient();

  const invalidateAfterMutation = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["order"] });
    queryClient.invalidateQueries({ queryKey: ["ceramics"] });
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}/approve`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to approve order");
      return json;
    },
    onSuccess: () => {
      toast.success("Order approved — stock deducted and sale recorded.");
      invalidateAfterMutation();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to approve order");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const res = await fetch(`/api/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reject order");
      return json;
    },
    onSuccess: () => {
      toast.success("Order rejected.");
      invalidateAfterMutation();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reject order");
    },
  });

  const paymentStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      paymentStatus,
    }: {
      orderId: string;
      paymentStatus: "paid" | "unpaid";
    }) => {
      const res = await fetch(`/api/orders/${orderId}/payment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update payment status");
      return json;
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.paymentStatus === "paid" ? "Marked as paid." : "Marked as unpaid.",
      );
      invalidateAfterMutation();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update payment status");
    },
  });

  const returnMutation = useMutation({
    mutationFn: async ({
      orderId,
      items,
      notes,
    }: {
      orderId: string;
      items: { orderItemId: string; quantity: number }[];
      notes?: string;
    }) => {
      const res = await fetch(`/api/orders/${orderId}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record return");
      return json;
    },
    onSuccess: () => {
      toast.success("Return recorded — stock restored.");
      invalidateAfterMutation();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record return");
    },
  });

  return { approveMutation, rejectMutation, paymentStatusMutation, returnMutation };
}
