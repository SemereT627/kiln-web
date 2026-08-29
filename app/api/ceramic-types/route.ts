import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { pickSortColumn } from "@/lib/postgrest";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const SORTABLE_COLUMNS = ["size", "measurement_unit", "price_per_unit", "created_at"] as const;

const createCeramicTypeSchema = z.object({
  brand_id: z.string().min(1, "brand_id is required"),
  size: z.string().trim().min(1, "size is required"),
  finish_id: z.string().min(1, "finish_id is required"),
  measurement_unit: z.enum(["m²", "m", "pcs"]).optional(),
  price_per_unit: z.union([z.number(), z.string()]).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const sortBy = pickSortColumn(searchParams.get("sortBy") || "size", SORTABLE_COLUMNS, "size");
    const order = searchParams.get("order") || "asc";
    const brandId = searchParams.get("brandId");

    const supabase = await createClient();
    let query = supabase
      .from("ceramic_types")
      .select("*, brand:brands(name), finish:finishes(name)", { count: "exact" });

    if (brandId) {
      query = query.eq("brand_id", brandId);
    }

    if (search) {
      // Search in size or brand name if possible, but brand is a join
      // For now just search in size
      query = query.ilike("size", `%${search}%`);
    }

    if (limit !== -1) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order(sortBy, { ascending: order === "asc" });

    if (error) throw error;
    
    // Normalise: ensure measurement_unit always has a value
    const normalised = (data || []).map((t: any) => ({
      ...t,
      measurement_unit: t.measurement_unit || "m²",
    }));

    return NextResponse.json({
      data: normalised,
      total: count || 0,
      page: limit === -1 ? 1 : page,
      limit: limit === -1 ? count : limit
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(request, createCeramicTypeSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const supabase = await createClient();
  const payload: any = {
    brand_id: body.brand_id,
    size: body.size,
    finish_id: body.finish_id,
  };
  if (body.measurement_unit) payload.measurement_unit = body.measurement_unit;
  if (body.price_per_unit !== undefined && body.price_per_unit !== null && body.price_per_unit !== "") {
    payload.price_per_unit = parseFloat(String(body.price_per_unit));
  }
  const { data, error } = await supabase.from("ceramic_types").insert([payload]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: admin,
    action: "ceramic_type.create",
    targetTable: "ceramic_types",
    targetId: data.id,
    after: data,
  });

  return NextResponse.json(data);
}
