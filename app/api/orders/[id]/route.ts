import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin, requireSeller } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const updateOrderSchema = z.object({
  paymentMethod: z.enum(["cash", "bank_transfer", "credit"]).optional(),
  bankAccount: z.string().trim().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        quantity: z.number().positive("quantity must be greater than 0"),
      }),
    )
    .optional(),
});

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
  ),
  return_requests(
    id,
    status,
    notes,
    rejection_reason,
    created_at,
    reviewed_at,
    seller:user_profiles!return_requests_seller_id_fkey(full_name),
    reviewed_by:user_profiles!return_requests_reviewed_by_fkey(full_name),
    return_request_items(id, order_item_id, quantity)
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
    returnRequests: (order.return_requests || []).map((rr: any) => ({
      id: rr.id,
      status: rr.status,
      notes: rr.notes,
      rejectionReason: rr.rejection_reason,
      createdAt: rr.created_at,
      reviewedAt: rr.reviewed_at,
      sellerName: rr.seller?.full_name ?? null,
      reviewedByName: rr.reviewed_by?.full_name ?? null,
      items: (rr.return_request_items || []).map((ri: any) => ({
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
    const supabase = await createServiceClient();
    const isAdmin = user.role === "admin";

    let query = supabase.from("orders").select(ORDER_SELECT).eq("id", id);
    if (!isAdmin) {
      query = query.eq("seller_id", user.id);
    }
    const { data, error } = await query.single();

    if (error) {
      // Ownership-filtered miss and genuine not-found both look like a
      // missing row — don't distinguish, or a seller could probe order IDs.
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
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

    const parsed = await parseBody(request, updateOrderSchema);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const supabase = await createServiceClient();

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
