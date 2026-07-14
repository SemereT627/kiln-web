import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface OrderItemInput {
  ceramicId: string;
  quantity: number;
}

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
    total: (order.order_items || []).reduce(
      (sum: number, item: any) => sum + item.quantity * item.price_at_sale,
      0,
    ),
  };
}

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

export async function GET(request: Request) {
  try {
    const user = await requireSeller(request);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const mineOnly = searchParams.get("mine") === "1";

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const isAdmin = profile?.role === "admin";

    let query = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }
    if (mineOnly || !isAdmin) {
      query = query.eq("seller_id", user.id);
    }
    if (limit !== -1) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({
      data: (data || []).map(formatOrder),
      total: count || 0,
      page: limit === -1 ? 1 : page,
      limit: limit === -1 ? count : limit,
    });
  } catch (error: any) {
    console.error("GET Orders Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const seller = await requireSeller(request);
    if (!seller) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const items: OrderItemInput[] = body.items;
    const paymentMethod = body.paymentMethod;
    const bankAccount = body.bankAccount ?? null;
    const notes = body.notes ?? null;
    const clientId = body.clientId ?? null;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order must have at least one item" }, { status: 400 });
    }
    if (!["cash", "bank_transfer", "credit"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }
    if (paymentMethod === "bank_transfer" && !bankAccount) {
      return NextResponse.json({ error: "Bank account is required for bank transfers" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const ceramicIds = items.map((i) => i.ceramicId);
    const { data: ceramics, error: ceramicsError } = await supabase
      .from("vw_ceramics_inventory")
      .select("id, price_per_unit")
      .in("id", ceramicIds);
    if (ceramicsError) throw ceramicsError;

    const priceMap = new Map<string, number>(
      (ceramics || []).map((c: { id: string; price_per_unit: number | null }) => [c.id, c.price_per_unit ?? 0]),
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          seller_id: seller.id,
          payment_method: paymentMethod,
          bank_account: paymentMethod === "bank_transfer" ? bankAccount : null,
          payment_status: paymentMethod === "credit" ? "unpaid" : "paid",
          notes,
          client_id: clientId,
        },
      ])
      .select()
      .single();
    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item) => ({
        order_id: order.id,
        ceramic_id: item.ceramicId,
        quantity: item.quantity,
        price_at_sale: priceMap.get(item.ceramicId) ?? 0,
      })),
    );
    if (itemsError) throw itemsError;

    await logAudit({
      actor: seller,
      action: "order.create",
      targetTable: "orders",
      targetId: order.id,
      after: {
        paymentMethod,
        bankAccount: order.bank_account,
        items: items.map((i) => ({ ceramicId: i.ceramicId, quantity: i.quantity })),
      },
    });

    return NextResponse.json({ id: order.id, status: order.status }, { status: 201 });
  } catch (error: any) {
    console.error("POST Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
