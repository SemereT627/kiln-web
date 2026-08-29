"use client";

import { useEffect, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes admins to live order + return-request events (new submissions,
 * status changes) so the Order Approvals queue and sidebar badge update
 * without polling. Return requests share this hook rather than getting
 * their own — they're folded into the Orders page, not a separate queue.
 *
 * Mounted from both the sidebar (badge) and the Orders page at once — each
 * needs its own channel name, since Supabase reuses a channel by name and
 * throws if a second `.on()` is added after the first mount already
 * subscribed it.
 */
export function useOrdersRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  const instanceId = useId();

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`orders-realtime-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          toast.info("New order submitted", {
            description: "A seller submitted an order awaiting your approval.",
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "return_requests" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["return-requests"] });
          toast.info("New return request", {
            description: "A seller requested a return awaiting your approval.",
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "return_requests" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["return-requests"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient, instanceId]);
}
