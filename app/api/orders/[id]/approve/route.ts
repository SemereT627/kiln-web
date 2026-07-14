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
    const supabase = await createServiceClient();

    const { data: before } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .single();

    const { data: sales, error } = await supabase.rpc("approve_order", {
      p_order_id: id,
      p_admin_id: admin.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logAudit({
      actor: admin,
      action: "order.approve",
      targetTable: "orders",
      targetId: id,
      before: before
        ? {
            items: before.order_items.map((i: any) => ({
              ceramicId: i.ceramic_id,
              quantity: i.quantity,
            })),
          }
        : null,
      after: {
        saleIds: (sales || []).map((s: any) => s.sale_id),
      },
    });

    return NextResponse.json({ status: "approved", saleIds: (sales || []).map((s: any) => s.sale_id) });
  } catch (error: any) {
    console.error("POST Approve Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
