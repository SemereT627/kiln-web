import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface ReturnItemInput {
  orderItemId: string;
  quantity: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const items: ReturnItemInput[] = body.items;
    const notes = body.notes ?? null;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "A return must include at least one item" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: returnId, error } = await supabase.rpc("record_return", {
      p_order_id: id,
      p_admin_id: admin.id,
      p_items: items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })),
      p_notes: notes,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logAudit({
      actor: admin,
      action: "order.return",
      targetTable: "orders",
      targetId: id,
      after: { returnId, items, notes },
    });

    return NextResponse.json({ id: returnId }, { status: 201 });
  } catch (error: any) {
    console.error("POST Order Return Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
