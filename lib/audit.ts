import { createServiceClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

interface LogAuditArgs {
  actor: User | { id: string; email?: string | null } | null;
  action: string;
  targetTable: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Fire-and-forget audit trail write. Never throws — a logging failure must
 * not block the mutation it's describing. */
export async function logAudit({
  actor,
  action,
  targetTable,
  targetId,
  before,
  after,
}: LogAuditArgs) {
  try {
    const supabase = await createServiceClient();
    await supabase.from("audit_logs").insert([
      {
        actor_id: actor?.id ?? null,
        actor_name: actor?.email ?? null,
        action,
        target_table: targetTable,
        target_id: targetId ?? null,
        before: before ?? null,
        after: after ?? null,
      },
    ]);
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}
