import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  const supabase = await createServiceClient();
  const { data, error, count } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formatted = (data || []).map((log: any) => ({
    id: log.id,
    actorId: log.actor_id,
    actorName: log.actor_name,
    action: log.action,
    targetTable: log.target_table,
    targetId: log.target_id,
    before: log.before,
    after: log.after,
    createdAt: log.created_at,
  }));

  return NextResponse.json({
    data: formatted,
    total: count || 0,
    page,
    limit,
  });
}
