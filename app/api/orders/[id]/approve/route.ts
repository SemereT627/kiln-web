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
    const overrides: { orderItemId: string; priceAtSale?: number; quantity?: number }[] =
      Array.isArray(body?.overrides) ? body.overrides : [];

    for (const override of overrides) {
      if (!override.orderItemId) {
        return NextResponse.json({ error: "Invalid override" }, { status: 400 });
      }
      if (override.priceAtSale !== undefined && !(Number(override.priceAtSale) > 0)) {
        return NextResponse.json(
          { error: "Price at sale must be greater than 0" },
          { status: 400 },
        );
      }
      if (override.quantity !== undefined && !(Number(override.quantity) > 0)) {
        return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
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
      p_overrides: overrides.length > 0 ? overrides : null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const overrideMap = new Map(overrides.map((o) => [o.orderItemId, o]));

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
          ? before.order_items.map((i: any) => {
              const override = overrideMap.get(i.id);
              return {
                ceramicId: i.ceramic_id,
                quantity: override?.quantity ?? i.quantity,
                priceAtSale: override?.priceAtSale ?? i.price_at_sale,
              };
            })
          : [],
      },
    });

    return NextResponse.json({ status: "approved", saleIds: (sales || []).map((s: any) => s.sale_id) });
  } catch (error: any) {
    console.error("POST Approve Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
