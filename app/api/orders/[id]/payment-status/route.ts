import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const paymentStatusSchema = z.object({
  paymentStatus: z.enum(["paid", "unpaid"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const parsed = await parseBody(request, paymentStatusSchema);
    if ("response" in parsed) return parsed.response;
    const { paymentStatus } = parsed.data;

    const supabase = await createServiceClient();

    const { data: before } = await supabase
      .from("orders")
      .select("payment_status")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("orders")
      .update({
        payment_status: paymentStatus,
        paid_by: paymentStatus === "paid" ? admin.id : null,
        paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    await logAudit({
      actor: admin,
      action: "order.payment_status_change",
      targetTable: "orders",
      targetId: id,
      before: { paymentStatus: before?.payment_status },
      after: { paymentStatus: data.payment_status, paidBy: data.paid_by, paidAt: data.paid_at },
    });

    return NextResponse.json({ paymentStatus: data.payment_status, paidBy: data.paid_by, paidAt: data.paid_at });
  } catch (error: any) {
    console.error("PATCH Order Payment Status Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
