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
    const body = await request.json().catch(() => ({}));
    const priceOverrides: { orderItemId: string; priceAtSale: number }[] = Array.isArray(
      body?.priceOverrides,
    )
      ? body.priceOverrides
      : [];

    for (const override of priceOverrides) {
      if (!override.orderItemId || !(Number(override.priceAtSale) > 0)) {
        return NextResponse.json(
          { error: "Price at sale must be greater than 0" },
          { status: 400 },
        );
      }
    }

    const supabase = await createServiceClient();

    const { data: before } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .single();

    const { data: sales, error } = await supabase.rpc("approve_order", {
      p_order_id: id,
      p_admin_id: admin.id,
      p_price_overrides: priceOverrides.length > 0 ? priceOverrides : null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const overrideMap = new Map(priceOverrides.map((o) => [o.orderItemId, o.priceAtSale]));

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
              priceAtSale: i.price_at_sale,
            })),
          }
        : null,
      after: {
        saleIds: (sales || []).map((s: any) => s.sale_id),
        items: before
          ? before.order_items.map((i: any) => ({
              ceramicId: i.ceramic_id,
              priceAtSale: overrideMap.get(i.id) ?? i.price_at_sale,
            }))
          : [],
      },
    });

    return NextResponse.json({ status: "approved", saleIds: (sales || []).map((s: any) => s.sale_id) });
  } catch (error: any) {
    console.error("POST Approve Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
