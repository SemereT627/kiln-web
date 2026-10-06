import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sanitizeSearchTerm } from "@/lib/postgrest";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = sanitizeSearchTerm(searchParams.get("search") || "");
    const ceramicId = searchParams.get("ceramicId");
    const orderId = searchParams.get("orderId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const supabase = await createClient();

    // Resolved up front so we can short-circuit with an empty result when
    // the order has no linked sales, instead of building a query with an
    // empty .in() filter (which Supabase/PostgREST treats as "no filter").
    let orderSaleIds: string[] | null = null;
    if (orderId) {
      const { data: orderItemRows, error: orderItemsError } = await supabase
        .from("order_items")
        .select("sale_id")
        .eq("order_id", orderId)
        .not("sale_id", "is", null);
      if (orderItemsError) throw orderItemsError;

      orderSaleIds = (orderItemRows || [])
        .map((r: { sale_id: string | null }) => r.sale_id)
        .filter((id): id is string => !!id);

      if (orderSaleIds.length === 0) {
        return NextResponse.json({ data: [], total: 0, page: 1, limit: 0 });
      }
    }

    let query = supabase
      .from("sales")
      .select(`
        *,
        ceramic:ceramics(
          product_code,
          name,
          ceramic_type:ceramic_types(size, measurement_unit, brand:brands(name), finish:finishes(name))
        ),
        order_items(
          order_id,
          order:orders(payment_method, seller:user_profiles!orders_seller_id_fkey(full_name))
        )
      `, { count: "exact" });

    if (search) {
      query = query.or(`ceramic.name.ilike.%${search}%,ceramic.product_code.ilike.%${search}%`);
    }

    if (ceramicId) {
      query = query.eq("ceramic_id", ceramicId);
    }

    if (orderSaleIds) {
      query = query.in("id", orderSaleIds);
    }

    // Day boundaries are computed in Addis Ababa local time (fixed UTC+3,
    // no DST) so a dateFrom/dateTo pair lines up exactly with how
    // get_sales_day_summary buckets sales into calendar days.
    if (dateFrom) {
      query = query.gte("sold_at", `${dateFrom}T00:00:00.000+03:00`);
    }
    if (dateTo) {
      query = query.lte("sold_at", `${dateTo}T23:59:59.999+03:00`);
    }

    if (limit !== -1) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order("sold_at", { ascending: false });

    if (error) throw error;

    const formattedData = (data || []).map((item: any) => {
      const orderItem = item.order_items?.[0] ?? null;
      return {
        id: item.id,
        quantity: item.quantity,
        priceAtSale: item.price_at_sale ?? null,
        createdAt: item.sold_at,
        productName: item.ceramic?.name,
        productCode: item.ceramic?.product_code,
        brand: item.ceramic?.ceramic_type?.brand?.name,
        size: item.ceramic?.ceramic_type?.size,
        finish: item.ceramic?.ceramic_type?.finish?.name,
        measurementUnit: item.ceramic?.ceramic_type?.measurement_unit || "m²",
        orderId: orderItem?.order_id ?? null,
        orderSellerName: orderItem?.order?.seller?.full_name ?? null,
        orderPaymentMethod: orderItem?.order?.payment_method ?? null,
      };
    });

    return NextResponse.json({
      data: formattedData,
      total: count || 0,
      page: limit === -1 ? 1 : page,
      limit: limit === -1 ? count : limit
    });
  } catch (error: any) {
    console.error("GET Sales Error:", error);
    return NextResponse.json({ data: [], total: 0, error: error.message }, { status: 500 });
  }
}

async function resolvePrice(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  ceramicId: string,
  priceAtSale: unknown,
) {
  if (priceAtSale !== undefined && priceAtSale !== null) {
    return parseFloat(priceAtSale as string);
  }
  const { data: ceramic } = await supabase
    .from("vw_ceramics_inventory")
    .select("price_per_unit")
    .eq("id", ceramicId)
    .single();
  return ceramic?.price_per_unit ?? 0;
}

export async function POST(request: Request) {
  try {
    const seller = await requireSeller(request);
    if (!seller) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServiceClient();
    const body = await request.json();

    // Batch checkout: { items: [{ ceramicId, quantity, priceAtSale? }, ...] }
    if (Array.isArray(body.items)) {
      const items = body.items as {
        ceramicId: string;
        quantity: number;
        priceAtSale?: number | null;
      }[];

      if (items.length === 0) {
        return NextResponse.json({ error: "No items provided" }, { status: 400 });
      }

      const results: {
        ceramicId: string;
        success: boolean;
        data?: Record<string, unknown>;
        error?: string;
      }[] = [];

      for (const item of items) {
        if (!item.ceramicId || !item.quantity) {
          results.push({
            ceramicId: item.ceramicId,
            success: false,
            error: "Missing required fields",
          });
          continue;
        }

        const priceAtSale = await resolvePrice(supabase, item.ceramicId, item.priceAtSale);

        const { data, error } = await supabase
          .from("sales")
          .insert([
            {
              ceramic_id: item.ceramicId,
              quantity: item.quantity,
              price_at_sale: priceAtSale,
              sold_by: seller.id,
              sold_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (error) {
          results.push({ ceramicId: item.ceramicId, success: false, error: error.message });
        } else {
          results.push({ ceramicId: item.ceramicId, success: true, data });
          await logAudit({
            actor: seller,
            action: "sale.create",
            targetTable: "sales",
            targetId: data.id,
            after: {
              ceramicId: item.ceramicId,
              quantity: item.quantity,
              priceAtSale,
            },
          });
        }
      }

      return NextResponse.json({ results }, { status: 201 });
    }

    const { ceramicId, quantity } = body;

    if (!ceramicId || !quantity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const priceAtSale = await resolvePrice(supabase, ceramicId, body.priceAtSale);

    const insertPayload = {
      ceramic_id: ceramicId,
      quantity,
      price_at_sale: priceAtSale,
      sold_by: seller.id,
      sold_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("sales")
      .insert([insertPayload])
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      actor: seller,
      action: "sale.create",
      targetTable: "sales",
      targetId: data.id,
      after: {
        ceramicId,
        quantity,
        priceAtSale,
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("POST Sale Error:", error);
    const isOversell = error.message?.includes("exceeds current stock");
    return NextResponse.json(
      { error: error.message },
      { status: isOversell ? 400 : 500 }
    );
  }
}
