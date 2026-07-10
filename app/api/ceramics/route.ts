import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? user : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "updated_at";
    const order = searchParams.get("order") || "desc";
    
    // Filters
    const brandId = searchParams.get("brandId");
    const finishId = searchParams.get("finishId");
    const size = searchParams.get("size");
    const status = searchParams.get("status");

    const supabase = await createClient();
    
    let query = supabase
      .from("vw_ceramics_inventory")
      .select("*", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,product_code.ilike.%${search}%`);
    }

    if (brandId) {
      query = query.eq("brand_id", brandId);
    }

    if (finishId) {
      // Get the finish name for this ID since the view has finish_name
      const { data: finishData } = await supabase
        .from("finishes")
        .select("name")
        .eq("id", finishId)
        .single();
      
      if (finishData) {
        query = query.eq("finish_name", finishData.name);
      }
    }

    if (size) {
      query = query.eq("size", size);
    }

    if (status) {
      if (status === "in") {
        query = query.gt("current_stock", 5);
      } else if (status === "low") {
        query = query.gt("current_stock", 0).lte("current_stock", 5);
      } else if (status === "out") {
        query = query.lte("current_stock", 0);
      }
    }

    // Allow fetching all if limit is -1
    if (limit !== -1) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order(sortBy, { ascending: order === "asc" });

    if (error) throw error;
    
    const formattedData = (data || []).map((item: any) => ({
      _id: item.id,
      productId: item.product_code,
      name: item.name,
      brand: item.brand_name || "Unknown",
      brandId: item.brand_id,
      size: item.size || "Unknown",
      finish: item.finish_name || "Normal",
      typeId: item.type_id,
      measurementUnit: item.measurement_unit || "m²",
      pricePerUnit: item.price_per_unit ?? null,
      initialStock: item.initial_stock,
      soldStock: item.sold_stock,
      currentStock: item.current_stock,
      imageUrl: item.image_url,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    // If limit is -1, we return the array directly for backward compatibility or special cases
    // but better to keep it consistent.
    return NextResponse.json({
      data: formattedData,
      total: count || 0,
      page: limit === -1 ? 1 : page,
      limit: limit === -1 ? count : limit
    });
  } catch (error: any) {
    console.error("GET Ceramics Error:", error);
    return NextResponse.json({ data: [], total: 0, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const body = await request.json();

    // 1. Insert product details into ceramics table
    const { data: ceramic, error: ceramicError } = await supabase
      .from("ceramics")
      .insert([{
        product_code: body.productId,
        name: body.name,
        type_id: body.typeId,
        image_url: body.imageUrl
      }])
      .select()
      .single();

    if (ceramicError) throw ceramicError;

    // 2. Insert starting stock as the first Restock entry
    if (body.initialStock > 0) {
      const { error: stockError } = await supabase
        .from("stock_entries")
        .insert([{
          ceramic_id: ceramic.id,
          quantity: body.initialStock,
          entry_type: 'Restock'
        }]);
      if (stockError) throw stockError;
    }

    // Return the combined result from the view
    const { data: result, error: viewError } = await supabase
      .from("vw_ceramics_inventory")
      .select("*")
      .eq("id", ceramic.id)
      .single();

    if (viewError) throw viewError;

    const formattedData = {
      _id: result.id,
      productId: result.product_code,
      name: result.name,
      brand: result.brand_name,
      size: result.size,
      finish: result.finish_name,
      measurementUnit: result.measurement_unit || "m²",
      pricePerUnit: result.price_per_unit ?? null,
      initialStock: result.initial_stock,
      soldStock: result.sold_stock,
      currentStock: result.current_stock,
      imageUrl: result.image_url,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };

    return NextResponse.json(formattedData, { status: 201 });
  } catch (error: any) {
    console.error("POST Ceramic Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
