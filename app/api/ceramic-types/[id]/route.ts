import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { data: before } = await supabase
      .from("ceramic_types")
      .select("*")
      .eq("id", id)
      .single();

    const { brand_id, size, finish_id, measurement_unit, price_per_unit } = body;

    const updates: any = {};
    if (brand_id !== undefined) updates.brand_id = brand_id;
    if (size !== undefined) updates.size = size;
    if (finish_id !== undefined) updates.finish_id = finish_id;
    if (measurement_unit !== undefined) updates.measurement_unit = measurement_unit;
    if (price_per_unit !== undefined) {
      updates.price_per_unit = price_per_unit === "" ? null : parseFloat(price_per_unit);
    }

    const { data, error } = await supabase
      .from("ceramic_types")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      actor: admin,
      action: "ceramic_type.update",
      targetTable: "ceramic_types",
      targetId: id,
      before,
      after: data,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("PUT Ceramic Type Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: before } = await supabase
      .from("ceramic_types")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("ceramic_types").delete().eq("id", id);

    if (error) throw error;

    await logAudit({
      actor: admin,
      action: "ceramic_type.delete",
      targetTable: "ceramic_types",
      targetId: id,
      before,
    });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error: any) {
    console.error("DELETE Ceramic Type Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
