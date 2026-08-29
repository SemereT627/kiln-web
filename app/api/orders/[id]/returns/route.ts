import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const returnOrderSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        quantity: z.number().positive("quantity must be greater than 0"),
      }),
    )
    .min(1, "A return must include at least one item"),
  notes: z.string().nullable().optional(),
});

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

    const parsed = await parseBody(request, returnOrderSchema);
    if ("response" in parsed) return parsed.response;
    const items: ReturnItemInput[] = parsed.data.items;
    const notes = parsed.data.notes ?? null;

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
