import type { SupabaseClient } from "@supabase/supabase-js";

/** Browser-side: calls back when a new message lands. The caller passes its
 * own signed-in client (RLS limits it to admins). */
export function subscribeToPayments(supabase: SupabaseClient, channelName: string, onNew: () => void) {
  const channel = supabase
    .channel(channelName)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "msync_messages" }, onNew)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
