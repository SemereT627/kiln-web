import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const approveReturnRequestSchema = z.object({
  overrides: z
    .array(
      z.object({
        returnRequestItemId: z.string().min(1, "Invalid override"),
        quantity: z.number().positive("Quantity must be greater than 0").optional(),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { requestId } = await params;

    const parsed = await parseBody(request, approveReturnRequestSchema);
    if ("response" in parsed) return parsed.response;
    const { overrides } = parsed.data;

    const supabase = await createServiceClient();

    const { data: before } = await supabase
      .from("return_requests")
      .select("*, return_request_items(*)")
      .eq("id", requestId)
      .single();

    const { data: returnId, error } = await supabase.rpc("approve_return_request", {
      p_request_id: requestId,
      p_admin_id: admin.id,
      p_overrides: overrides.length > 0 ? overrides : null,
    });

    if (error) {
      const overCap = error.message?.includes("exceeds remaining returnable quantity");
      return NextResponse.json(
        {
          error: overCap
            ? error.message
            : "Couldn't approve this return request. Please try again.",
        },
        { status: 400 },
      );
    }

    await logAudit({
      actor: admin,
      action: "return_request.approve",
      targetTable: "return_requests",
      targetId: requestId,
      before: before
        ? { items: (before.return_request_items || []).map((i: any) => ({ id: i.id, quantity: i.quantity })) }
        : null,
      after: { returnId, overrides },
    });

    return NextResponse.json({ status: "approved", returnId });
  } catch (error: any) {
    console.error("POST Approve Return Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
