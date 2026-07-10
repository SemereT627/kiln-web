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
    const sortBy = searchParams.get("sortBy") || "size";
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
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const body = await request.json();
  const { measurement_unit, price_per_unit, ...rest } = body;
  const payload: any = { ...rest };
  if (measurement_unit) payload.measurement_unit = measurement_unit;
  if (price_per_unit !== undefined && price_per_unit !== null && price_per_unit !== "") {
    payload.price_per_unit = parseFloat(price_per_unit);
  }
  const { data, error } = await supabase.from("ceramic_types").insert([payload]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
