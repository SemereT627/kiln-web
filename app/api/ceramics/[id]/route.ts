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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ceramics")
      .select(`
        *,
        ceramic_types(id, size, brand_id, brand:brands(id, name), finish:finishes(name))
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formattedData = {
      _id: data.id,
      productId: data.product_code,
      name: data.name,
      brand: data.ceramic_types?.brand?.name,
      brandId: data.ceramic_types?.brand_id,
      size: data.ceramic_types?.size,
      finish: data.ceramic_types?.finish?.name,
      typeId: data.type_id,
      initialStock: data.initial_stock,
      soldStock: data.sold_stock,
      currentStock: data.current_stock,
      imageUrl: data.image_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    return NextResponse.json(formattedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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
      .from("vw_ceramics_inventory")
      .select("*")
      .eq("id", id)
      .single();

    const updates: any = {};
    if (body.productId !== undefined) updates.product_code = body.productId;
    if (body.name !== undefined) updates.name = body.name;
    if (body.typeId !== undefined) updates.type_id = body.typeId;
    if (body.imageUrl !== undefined) updates.image_url = body.imageUrl;

    const { error: ceramicError } = await supabase
      .from("ceramics")
      .update(updates)
      .eq("id", id);

    if (ceramicError) throw ceramicError;

    if (body.initialStock !== undefined) {
      // "Initial stock" is the earliest stock entry for this ceramic — there's
      // no distinct Initial type anymore, the first Restock/Adjustment serves that role.
      const { data: existing } = await supabase
        .from("stock_entries")
        .select("id")
        .eq("ceramic_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error: stockError } = await supabase
          .from("stock_entries")
          .update({ quantity: body.initialStock })
          .eq("id", existing.id);
        if (stockError) throw stockError;
      } else {
        const { error: stockError } = await supabase
          .from("stock_entries")
          .insert({ ceramic_id: id, quantity: body.initialStock, entry_type: "Restock" });
        if (stockError) throw stockError;
      }
    }

    // Fetch the updated calculation from the view
    const { data: result, error: viewError } = await supabase
      .from("vw_ceramics_inventory")
      .select("*")
      .eq("id", id)
      .single();

    if (viewError) throw viewError;

    const formattedData = {
      _id: result.id,
      productId: result.product_code,
      name: result.name,
      brand: result.brand_name,
      brandId: result.brand_id,
      size: result.size,
      finish: result.finish,
      typeId: result.type_id,
      initialStock: result.initial_stock,
      soldStock: result.sold_stock,
      currentStock: result.current_stock,
      imageUrl: result.image_url,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };

    await logAudit({
      actor: admin,
      action: "ceramic.update",
      targetTable: "ceramics",
      targetId: id,
      before: before
        ? {
            productId: before.product_code,
            name: before.name,
            imageUrl: before.image_url,
            initialStock: before.initial_stock,
          }
        : null,
      after: {
        productId: formattedData.productId,
        name: formattedData.name,
        imageUrl: formattedData.imageUrl,
        initialStock: formattedData.initialStock,
      },
    });

    return NextResponse.json(formattedData);
  } catch (error: any) {
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
      .from("vw_ceramics_inventory")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("ceramics")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await logAudit({
      actor: admin,
      action: "ceramic.delete",
      targetTable: "ceramics",
      targetId: id,
      before: before
        ? { productId: before.product_code, name: before.name }
        : null,
    });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
