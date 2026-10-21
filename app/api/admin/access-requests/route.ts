import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const STATUSES = ["pending", "approved", "rejected"] as const;

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status") ?? "pending";
  const status = (STATUSES as readonly string[]).includes(statusParam) ? statusParam : "pending";
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50"), 1), 200);

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("access_requests")
    .select("id, full_name, email, message, status, role, reviewed_at, created_at")
    .eq("status", status)
    .order(status === "pending" ? "created_at" : "reviewed_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (data ?? []).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      message: r.message,
      status: r.status,
      role: r.role,
      reviewedAt: r.reviewed_at,
      createdAt: r.created_at,
    })),
  );
}
