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
    ),
    return_items(quantity)
  ),
  returns(
    id,
    notes,
    created_at,
    created_by:user_profiles!returns_created_by_fkey(full_name),
    return_items(id, order_item_id, quantity)
  )
`;

function formatOrder(order: any) {
  const items = (order.order_items || []).map((item: any) => {
    const returnedQuantity = (item.return_items || []).reduce(
      (sum: number, ri: any) => sum + Number(ri.quantity),
      0,
    );
    return {
      id: item.id,
      ceramicId: item.ceramic_id,
      productName: item.ceramic?.name,
      productCode: item.ceramic?.product_code,
      quantity: item.quantity,
      priceAtSale: item.price_at_sale,
      measurementUnit: item.ceramic?.ceramic_type?.measurement_unit || "m²",
      saleId: item.sale_id,
      returnedQuantity,
    };
  });

  const total = items.reduce((sum: number, item: any) => sum + item.quantity * item.priceAtSale, 0);
  const returnedTotal = items.reduce(
    (sum: number, item: any) => sum + item.returnedQuantity * item.priceAtSale,
    0,
  );

  return {
    id: order.id,
    clientId: order.client_id,
    status: order.status,
    paymentMethod: order.payment_method,
    bankAccount: order.bank_account,
    paymentStatus: order.payment_status,
    paidBy: order.paid_by,
    paidAt: order.paid_at,
    notes: order.notes,
    sellerId: order.seller_id,
    sellerName: order.seller?.full_name ?? null,
    reviewedBy: order.reviewed_by,
    reviewedAt: order.reviewed_at,
    rejectionReason: order.rejection_reason,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items,
    total,
    returnedTotal,
    outstandingTotal: total - returnedTotal,
    hasReturns: returnedTotal > 0,
    returns: (order.returns || []).map((r: any) => ({
      id: r.id,
      notes: r.notes,
      createdAt: r.created_at,
      createdByName: r.created_by?.full_name ?? null,
      items: (r.return_items || []).map((ri: any) => ({
        id: ri.id,
        orderItemId: ri.order_item_id,
        quantity: ri.quantity,
      })),
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
