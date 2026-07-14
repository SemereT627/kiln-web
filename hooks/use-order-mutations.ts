"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Shared approve/reject mutations for orders — used by both the full
 * Order Approvals page and the notifications bell's quick-action panel. */
export function useOrderMutations() {
  const queryClient = useQueryClient();

  const invalidateAfterMutation = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
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

  return { approveMutation, rejectMutation };
}
