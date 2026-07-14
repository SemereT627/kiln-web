import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin, requireSeller } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const ORDER_SELECT = `
  *,
  seller:user_profiles!orders_seller_id_fkey(full_name),
  order_items(
    *,
    ceramic:ceramics(
      product_code,
      name,
      ceramic_type:ceramic_types(measurement_unit)
    )
  )
`;

function formatOrder(order: any) {
  return {
    id: order.id,
    clientId: order.client_id,
    status: order.status,
    paymentMethod: order.payment_method,
    bankAccount: order.bank_account,
    paymentStatus: order.payment_status,
    notes: order.notes,
    sellerId: order.seller_id,
    sellerName: order.seller?.full_name ?? null,
    reviewedBy: order.reviewed_by,
    reviewedAt: order.reviewed_at,
    rejectionReason: order.rejection_reason,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      ceramicId: item.ceramic_id,
      productName: item.ceramic?.name,
      productCode: item.ceramic?.product_code,
      quantity: item.quantity,
      priceAtSale: item.price_at_sale,
      measurementUnit: item.ceramic?.ceramic_type?.measurement_unit || "m²",
      saleId: item.sale_id,
    })),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSeller(request);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", id)
      .single();

    if (error) throw error;
    return NextResponse.json(formatOrder(data));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
    const supabase = await createServiceClient();
    const body = await request.json();

    const { data: before, error: beforeError } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", id)
      .single();
    if (beforeError) throw beforeError;
    if (before.status !== "pending") {
      return NextResponse.json({ error: "Only pending orders can be edited" }, { status: 400 });
    }

    const updates: any = {};
    if (body.paymentMethod !== undefined) updates.payment_method = body.paymentMethod;
    if (body.bankAccount !== undefined) updates.bank_account = body.bankAccount;
    if (body.notes !== undefined) updates.notes = body.notes;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from("orders").update(updates).eq("id", id);
      if (updateError) throw updateError;
    }

    if (Array.isArray(body.items)) {
      for (const item of body.items) {
        const { error: itemError } = await supabase
          .from("order_items")
          .update({ quantity: item.quantity })
          .eq("id", item.id)
          .eq("order_id", id);
        if (itemError) throw itemError;
      }
    }

    const { data: after, error: afterError } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", id)
      .single();
    if (afterError) throw afterError;

    await logAudit({
      actor: admin,
      action: "order.update",
      targetTable: "orders",
      targetId: id,
      before: formatOrder(before),
      after: formatOrder(after),
    });

    return NextResponse.json(formatOrder(after));
  } catch (error: any) {
    console.error("PATCH Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
