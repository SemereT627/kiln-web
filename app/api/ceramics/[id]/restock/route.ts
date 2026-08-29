import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const restockSchema = z.object({
  quantity: z.union([z.number(), z.string()]),
  entryType: z.enum(["Restock", "Adjustment", "Return"]).optional(),
  direction: z.enum(["add", "remove"]).optional(),
  reason: z.enum(["damaged", "lost", "miscount", "other"]).optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

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
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const parsed = await parseBody(request, restockSchema);
    if ("response" in parsed) return parsed.response;
    const { quantity, entryType = "Restock", direction, reason, supplier, notes } = parsed.data;

    const supabase = await createClient();

    const parsedQuantity = parseFloat(String(quantity));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return NextResponse.json(
        { error: "Quantity must be a number greater than 0" },
        { status: 400 }
      );
    }

    const insertPayload: any = {
      ceramic_id: id,
      quantity: parsedQuantity,
      entry_type: entryType,
    };

    if (entryType === "Adjustment") {
      if (direction !== "add" && direction !== "remove") {
        return NextResponse.json(
          { error: "Adjustment requires direction: 'add' or 'remove'" },
          { status: 400 }
        );
      }
      if (!reason) {
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
