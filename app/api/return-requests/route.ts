import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/return-requests — admin-only count/list across all orders, used
 * by the sidebar badge (?status=pending&limit=1 just for the total). Return
 * requests are otherwise viewed per-order (embedded in GET /api/orders/[id]
 * as `returnRequests`), not as their own page — see the domain-modeling
 * grill: they're folded into the Orders page, not a separate queue.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");

    const supabase = await createServiceClient();
    let query = supabase.from("return_requests").select("id", { count: "exact" });
    if (status) query = query.eq("status", status);
    if (limit !== -1) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ total: count || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
