import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        ceramicId: z.string().min(1, "ceramicId is required"),
        quantity: z.number().positive("quantity must be greater than 0"),
      }),
    )
    .min(1, "Order must have at least one item"),
  paymentMethod: z.enum(["cash", "bank_transfer", "credit"]),
  bankAccount: z.string().trim().nullable().optional(),
  notes: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
});

interface OrderItemInput {
  ceramicId: string;
  quantity: number;
}

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

  const total = items.reduce(
    (sum: number, item: any) => sum + item.quantity * item.priceAtSale,
    0,
  );
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
    pendingReturnRequestCount: (order.return_requests || []).filter(
      (rr: any) => rr.status === "pending",
    ).length,
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
    ),
    return_items(quantity)
  ),
  return_requests(id, status)
`;

export async function GET(request: Request) {
  try {
    const user = await requireSeller(request);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const paymentMethod = searchParams.get("paymentMethod");
    const paymentStatus = searchParams.get("paymentStatus");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const mineOnly = searchParams.get("mine") === "1";

    const supabase = await createServiceClient();
    const isAdmin = user.role === "admin";

    let query = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }
    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod);
    }
    if (paymentStatus) {
      query = query.eq("payment_status", paymentStatus);
    }
    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
    }
    if (mineOnly || !isAdmin) {
      query = query.eq("seller_id", user.id);
    }
    if (limit !== -1) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order("created_at", {
      ascending: false,
    });
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

    const parsed = await parseBody(request, createOrderSchema);
    if ("response" in parsed) return parsed.response;
    const { paymentMethod, clientId } = parsed.data;
    const items: OrderItemInput[] = parsed.data.items;
    const bankAccount = parsed.data.bankAccount ?? null;
    const notes = parsed.data.notes ?? null;

    if (paymentMethod === "bank_transfer" && !bankAccount) {
      return NextResponse.json(
        { error: "Bank account is required for bank transfers" },
        { status: 400 },
      );
    }

    const supabase = await createServiceClient();

    const ceramicIds = items.map((i) => i.ceramicId);
    const { data: ceramics, error: ceramicsError } = await supabase
      .from("vw_ceramics_inventory")
      .select("id, price_per_unit")
      .in("id", ceramicIds);
    if (ceramicsError) throw ceramicsError;

    const priceMap = new Map<string, number>(
      (ceramics || []).map(
        (c: { id: string; price_per_unit: number | null }) => [
          c.id,
          c.price_per_unit ?? 0,
        ],
      ),
    );

    const unknownId = ceramicIds.find((cid) => !priceMap.has(cid));
    if (unknownId) {
      return NextResponse.json(
        { error: `Unknown ceramic in order: ${unknownId}` },
        { status: 400 },
      );
    }

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
        items: items.map((i) => ({
          ceramicId: i.ceramicId,
          quantity: i.quantity,
        })),
      },
    });

    return NextResponse.json(
      { id: order.id, status: order.status },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("POST Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
