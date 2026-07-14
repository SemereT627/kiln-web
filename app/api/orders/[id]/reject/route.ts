import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const reason = body.reason;
    if (!reason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: before } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();
    if (!before || before.status !== "pending") {
      return NextResponse.json({ error: "Only pending orders can be rejected" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    await logAudit({
      actor: admin,
      action: "order.reject",
      targetTable: "orders",
      targetId: id,
      before: { status: before.status },
      after: { status: data.status, reason },
    });

    return NextResponse.json({ status: data.status });
  } catch (error: any) {
    console.error("POST Reject Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
