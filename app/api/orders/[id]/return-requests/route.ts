import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const returnRequestSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        quantity: z.number().positive("quantity must be greater than 0"),
      }),
    )
    .min(1, "A return request must include at least one item"),
  notes: z.string().nullable().optional(),
});

/**
 * POST /api/orders/[id]/return-requests — seller (mobile) requests a return
 * against one of their own approved orders. Sits 'pending' until an admin
 * approves (calls approve_return_request, which defers to record_return —
 * see supabase/schema.sql) or rejects it. Direct API call, no offline queue:
 * unlike a sale, a return request isn't something a seller needs to be able
 * to submit without signal.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const seller = await requireSeller(request);
    if (!seller) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const parsed = await parseBody(request, returnRequestSchema);
    if ("response" in parsed) return parsed.response;
    const { items, notes } = parsed.data;

    const supabase = await createServiceClient();
    const isAdmin = seller.role === "admin";

    let orderQuery = supabase.from("orders").select("id, status, seller_id").eq("id", id);
    if (!isAdmin) {
      orderQuery = orderQuery.eq("seller_id", seller.id);
    }
    const { data: order, error: orderError } = await orderQuery.single();
    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved orders can have returns requested" },
        { status: 400 },
      );
    }

    // Every orderItemId must actually belong to this order — the DB trigger
    // caps quantity per order_item but doesn't check order ownership.
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("id")
      .eq("order_id", id)
      .in(
        "id",
        items.map((i) => i.orderItemId),
      );
    if (itemsError) throw itemsError;
    const validIds = new Set((orderItems || []).map((i) => i.id));
    const unknownId = items.find((i) => !validIds.has(i.orderItemId));
    if (unknownId) {
      return NextResponse.json(
        { error: `Order item ${unknownId.orderItemId} does not belong to this order` },
        { status: 400 },
      );
    }

    const { data: returnRequest, error: insertError } = await supabase
      .from("return_requests")
      // seller_id is the order's owner, not necessarily the caller — an
      // admin can submit this on a seller's behalf from the web, and the
      // request must still show up under that seller's own view (RLS keys
      // off seller_id = auth.uid()).
      .insert([{ order_id: id, seller_id: order.seller_id, notes }])
      .select()
      .single();
    if (insertError) throw insertError;

    const { error: rowsError } = await supabase.from("return_request_items").insert(
      items.map((i) => ({
        return_request_id: returnRequest.id,
        order_item_id: i.orderItemId,
        quantity: i.quantity,
      })),
    );
    if (rowsError) {
      // Trigger-raised cap violation lands here — roll back the parent row
      // rather than leaving an itemless request behind.
      await supabase.from("return_requests").delete().eq("id", returnRequest.id);
      const overCap = rowsError.message?.includes("exceeds remaining returnable quantity");
      return NextResponse.json(
        {
          error: overCap
            ? rowsError.message
            : "Couldn't submit return request. Please try again.",
        },
        { status: 400 },
      );
    }

    await logAudit({
      actor: seller,
      action: "return_request.create",
      targetTable: "return_requests",
      targetId: returnRequest.id,
      after: { orderId: id, items, notes },
    });

    return NextResponse.json({ id: returnRequest.id }, { status: 201 });
  } catch (error: any) {
    console.error("POST Return Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
