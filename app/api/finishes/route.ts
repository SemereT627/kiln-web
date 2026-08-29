import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { pickSortColumn } from "@/lib/postgrest";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const SORTABLE_COLUMNS = ["name", "created_at"] as const;
const createFinishSchema = z.object({ name: z.string().trim().min(1, "Name is required") });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const sortBy = pickSortColumn(searchParams.get("sortBy") || "name", SORTABLE_COLUMNS, "name");
    const order = searchParams.get("order") || "asc";

    const supabase = await createClient();
    let query = supabase.from("finishes").select("*", { count: "exact" });

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (limit !== -1) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order(sortBy, { ascending: order === "asc" });

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
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

  const parsed = await parseBody(request, createFinishSchema);
  if ("response" in parsed) return parsed.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finishes")
    .insert([{ name: parsed.data.name }])
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: admin,
    action: "finish.create",
    targetTable: "finishes",
    targetId: data.id,
    after: data,
  });

  return NextResponse.json(data);
}
