import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const ceramicId = searchParams.get("ceramicId");

    const supabase = await createClient();
    
    let query = supabase
      .from("sales")
      .select(`
        *,
        ceramic:ceramics(
          product_code,
          name,
          ceramic_type:ceramic_types(size, measurement_unit, brand:brands(name), finish:finishes(name))
        )
      `, { count: "exact" });

    if (search) {
      query = query.or(`ceramic.name.ilike.%${search}%,ceramic.product_code.ilike.%${search}%`);
    }

    if (ceramicId) {
      query = query.eq("ceramic_id", ceramicId);
    }

    if (limit !== -1) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order("sold_at", { ascending: false });

    if (error) throw error;

    const formattedData = (data || []).map((item: any) => ({
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
    }));

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

export async function POST(request: Request) {
  try {
    const seller = await requireSeller(request);
    if (!seller) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServiceClient();
    const body = await request.json();
    const { ceramicId, quantity } = body;

    if (!ceramicId || !quantity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let priceAtSale =
      body.priceAtSale !== undefined && body.priceAtSale !== null
        ? parseFloat(body.priceAtSale)
        : null;

    if (priceAtSale === null) {
      const { data: ceramic } = await supabase
        .from("vw_ceramics_inventory")
        .select("price_per_unit")
        .eq("id", ceramicId)
        .single();
      priceAtSale = ceramic?.price_per_unit ?? 0;
    }

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
