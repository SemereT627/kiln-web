import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? user : null;
}

/** GET /api/ceramics/[id]/restock — returns restock/adjustment history for a ceramic */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("stock_entries")
      .select("*")
      .eq("ceramic_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map((entry: any) => ({
      id: entry.id,
      quantity: entry.quantity,
      entryType: entry.entry_type,
      direction: entry.direction,
      reason: entry.reason ?? null,
      supplier: entry.supplier ?? null,
      notes: entry.notes ?? null,
      createdAt: entry.created_at,
    }));

    return NextResponse.json({ data: formatted });
  } catch (error: any) {
    console.error("GET Restock History Error:", error);
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }
}

/** POST /api/ceramics/[id]/restock — insert a new restock/adjustment entry */
export async function POST(
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

    const { quantity, entryType = "Restock", direction, reason, supplier, notes } = body;

    if (!quantity || parseFloat(quantity) <= 0) {
      return NextResponse.json(
        { error: "Quantity must be greater than 0" },
        { status: 400 }
      );
    }

    const insertPayload: any = {
      ceramic_id: id,
      quantity: parseFloat(quantity),
      entry_type: entryType,
    };

    if (entryType === "Adjustment") {
      if (direction !== "add" && direction !== "remove") {
        return NextResponse.json(
          { error: "Adjustment requires direction: 'add' or 'remove'" },
          { status: 400 }
        );
      }
      if (!["damaged", "lost", "miscount", "other"].includes(reason)) {
        return NextResponse.json(
          { error: "Adjustment requires reason: 'damaged', 'lost', 'miscount', or 'other'" },
          { status: 400 }
        );
      }
      insertPayload.direction = direction;
      insertPayload.reason = reason;
    }

    if (supplier) insertPayload.supplier = supplier.trim();
    if (notes) insertPayload.notes = notes.trim();

    const { data, error } = await supabase
      .from("stock_entries")
      .insert([insertPayload])
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      actor: admin,
      action: "stock.entry_create",
      targetTable: "stock_entries",
      targetId: id,
      after: {
        quantity: data.quantity,
        entryType: data.entry_type,
        direction: data.direction,
        reason: data.reason ?? null,
      },
    });

    return NextResponse.json(
      {
        id: data.id,
        quantity: data.quantity,
        entryType: data.entry_type,
        direction: data.direction,
        reason: data.reason ?? null,
        supplier: data.supplier ?? null,
        notes: data.notes ?? null,
        createdAt: data.created_at,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST Restock Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
