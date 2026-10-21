import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendEmail, requestRejectedEmail } from "@/lib/email";

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
    const supabase = await createServiceClient();

    const { data: req } = await supabase
      .from("access_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (!req || req.status !== "pending") {
      return NextResponse.json({ error: "Only pending requests can be rejected" }, { status: 400 });
    }

    const { error } = await supabase
      .from("access_requests")
      .update({
        status: "rejected",
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { ok: emailSent } = await sendEmail({
      to: req.email,
      ...requestRejectedEmail(req.full_name),
    });

    await logAudit({
      actor: admin,
      action: "access_request.reject",
      targetTable: "access_requests",
      targetId: id,
      before: { status: "pending" },
      after: { status: "rejected", email: req.email },
    });

    return NextResponse.json({ success: true, emailSent });
  } catch (error: unknown) {
    console.error("Reject access request error:", error);
    const message = (error as { message?: string } | null)?.message ?? "Failed to reject request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
