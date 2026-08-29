import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const updateCeramicSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  typeId: z.string().min(1).optional(),
  imageUrl: z.string().nullable().optional(),
  initialStock: z.union([z.number(), z.string()]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    // Read from the inventory view, never the raw table — it's the only
    // place current/initial/sold stock are computed, and it keeps this
    // response shape identical to GET /api/ceramics (list).
    const { data, error } = await supabase
      .from("vw_ceramics_inventory")
      .select("*")
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
      brand: data.brand_name || "Unknown",
      brandId: data.brand_id,
      size: data.size || "Unknown",
      finish: data.finish_name || "Normal",
      typeId: data.type_id,
      measurementUnit: data.measurement_unit || "m²",
      pricePerUnit: data.price_per_unit ?? null,
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
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const parsed = await parseBody(request, updateCeramicSchema);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const supabase = await createClient();

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
      // "Initial stock" (vw_ceramics_inventory.initial_stock) is actually the
      // sum of every stock_entries row for this ceramic, not a single ledger
      // entry — there's no one row to mutate. Editing it here means "recount
      // the total to this value", which we record as an Adjustment entry for
      // the delta, same as any other manual correction (never rewrite history).
      const targetTotal = Math.max(0, Number(body.initialStock) || 0);
      const currentTotal = Number(before?.initial_stock ?? 0);
      const delta = targetTotal - currentTotal;

      if (delta !== 0) {
        const { error: stockError } = await supabase.from("stock_entries").insert({
          ceramic_id: id,
          quantity: Math.abs(delta),
          entry_type: "Adjustment",
          direction: delta > 0 ? "add" : "remove",
          reason: "miscount",
          notes: "Recount via Initial Stock edit",
        });
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
    const admin = await requireAdmin(request);
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
