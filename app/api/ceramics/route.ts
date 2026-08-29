import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sanitizeSearchTerm, pickSortColumn } from "@/lib/postgrest";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const createCeramicSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, "Name is required"),
  typeId: z.string().min(1, "typeId is required"),
  imageUrl: z.string().nullable().optional(),
  initialStock: z.number().min(0).optional(),
});

const SORTABLE_COLUMNS = [
  "name",
  "product_code",
  "brand_name",
  "size",
  "finish_name",
  "price_per_unit",
  "initial_stock",
  "sold_stock",
  "current_stock",
  "created_at",
  "updated_at",
] as const;
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = sanitizeSearchTerm(searchParams.get("search") || "");
    const sortBy = pickSortColumn(
      searchParams.get("sortBy") || "updated_at",
      SORTABLE_COLUMNS,
      "updated_at",
    );
    const order = searchParams.get("order") || "desc";
    
    // Filters
    const brandId = searchParams.get("brandId");
    const finishId = searchParams.get("finishId");
    const size = searchParams.get("size");
    const status = searchParams.get("status");

    const supabase = await createClient();

    // Resolve finish name once (view stores finish_name, not id)
    let finishName: string | null = null;
    if (finishId) {
      const { data: finishData } = await supabase
        .from("finishes")
        .select("name")
        .eq("id", finishId)
        .single();
      finishName = finishData?.name ?? null;
    }

    // Apply the same set of filters to any query builder against the view
    const applyFilters = (q: any) => {
      if (search) {
        q = q.or(`name.ilike.%${search}%,product_code.ilike.%${search}%`);
      }
      if (brandId) q = q.eq("brand_id", brandId);
      if (finishName) q = q.eq("finish_name", finishName);
      if (size) q = q.eq("size", size);
      if (status === "in") q = q.gt("current_stock", 5);
      else if (status === "low") q = q.gt("current_stock", 0).lte("current_stock", 5);
      else if (status === "out") q = q.lte("current_stock", 0);
      return q;
    };

    let query = applyFilters(
      supabase.from("vw_ceramics_inventory").select("*", { count: "exact" }),
    );

    // Allow fetching all if limit is -1
    if (limit !== -1) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order(sortBy, { ascending: order === "asc" });

    if (error) throw error;

    // Summary across the ENTIRE filtered set (not just the current page) —
    // aggregated in Postgres (get_ceramics_summary), not by fetching every
    // row into Node, so it's correct regardless of catalog size.
    const { data: summaryRows, error: summaryError } = await supabase.rpc(
      "get_ceramics_summary",
      {
        p_search: search || null,
        p_brand_id: brandId || null,
        p_finish_name: finishName || null,
        p_size: size || null,
        p_status: status || null,
      },
    );
    if (summaryError) throw summaryError;

    const totals = { initialStock: 0, soldStock: 0, currentStock: 0 };
    const byType = (summaryRows || []).map((row: any) => {
      const rowCurrent = Number(row.current_stock) || 0;
      const rowInitial = Number(row.initial_stock) || 0;
      const rowSold = Number(row.sold_stock) || 0;
      totals.initialStock += rowInitial;
      totals.soldStock += rowSold;
      totals.currentStock += rowCurrent;

      const label = [row.brand_name, row.size, row.finish_name]
        .filter(Boolean)
        .join(" · ") || "Unknown";
      return {
        typeId: row.type_id || "unknown",
        label,
        brand: row.brand_name || "Unknown",
        size: row.size || "Unknown",
        finish: row.finish_name || "Normal",
        measurementUnit: row.measurement_unit || "m²",
        pricePerUnit: row.price_per_unit ?? null,
        initialStock: rowInitial,
        soldStock: rowSold,
        currentStock: rowCurrent,
        productCount: Number(row.product_count) || 0,
      };
    });
    byType.sort((a: any, b: any) => {
      const brandCmp = a.brand.localeCompare(b.brand);
      if (brandCmp !== 0) return brandCmp;
      return a.size.localeCompare(b.size, undefined, { numeric: true });
    });
    
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
      limit: limit === -1 ? count : limit,
      summary: {
        totalStock: totals.currentStock,
        totalInitial: totals.initialStock,
        totalSold: totals.soldStock,
        byType,
      },
    });
  } catch (error: any) {
    console.error("GET Ceramics Error:", error);
    return NextResponse.json({ data: [], total: 0, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(request, createCeramicSchema);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const supabase = await createClient();

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
    const parsedInitialStock = Number(body.initialStock);
    if (Number.isFinite(parsedInitialStock) && parsedInitialStock > 0) {
      const { error: stockError } = await supabase
        .from("stock_entries")
        .insert([{
          ceramic_id: ceramic.id,
          quantity: parsedInitialStock,
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

    await logAudit({
      actor: admin,
      action: "ceramic.create",
      targetTable: "ceramics",
      targetId: ceramic.id,
      after: formattedData,
    });

    return NextResponse.json(formattedData, { status: 201 });
  } catch (error: any) {
    console.error("POST Ceramic Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
