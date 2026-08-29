import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const rejectReturnRequestSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required"),
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

    const parsed = await parseBody(request, rejectReturnRequestSchema);
    if ("response" in parsed) return parsed.response;
    const { reason } = parsed.data;

    const supabase = await createServiceClient();

    const { data: before } = await supabase
      .from("return_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (!before || before.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending return requests can be rejected" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("return_requests")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select()
      .single();
    if (error) throw error;

    await logAudit({
      actor: admin,
      action: "return_request.reject",
      targetTable: "return_requests",
      targetId: requestId,
      before: { status: before.status },
      after: { status: data.status, reason },
    });

    return NextResponse.json({ status: data.status });
  } catch (error: any) {
    console.error("POST Reject Return Request Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
