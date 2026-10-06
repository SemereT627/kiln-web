import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { sanitizeSearchTerm } from "@/lib/postgrest";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = sanitizeSearchTerm(searchParams.get("search") || "");
  const targetTable = searchParams.get("targetTable");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const offset = (page - 1) * limit;

  const supabase = await createServiceClient();
  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" });

  if (search) {
    query = query.or(`actor_name.ilike.%${search}%,target_id.ilike.%${search}%`);
  }
  if (targetTable) {
    query = query.eq("target_table", targetTable);
  }
  if (dateFrom) {
    query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
  }
  if (dateTo) {
    query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
  }

  const { data, error, count } = await query
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
