import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createAndSendInvite } from "@/lib/access-invite";

/** Sends a fresh set-password link for an approved request whose first
 * invite expired or got lost. The user already exists, so this uses a
 * recovery link — it lands on the same /set-password page. */
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
    if (!req || req.status !== "approved" || !req.user_id) {
      return NextResponse.json({ error: "Only approved requests can be re-invited" }, { status: 400 });
    }

    const { emailSent, error } = await createAndSendInvite(supabase, request, {
      type: "recovery",
      email: req.email,
      fullName: req.full_name,
      role: req.role ?? "viewer",
    });
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    await logAudit({
      actor: admin,
      action: "access_request.resend_invite",
      targetTable: "access_requests",
      targetId: id,
      after: { email: req.email, emailSent },
    });

    return NextResponse.json({ success: true, emailSent });
  } catch (error: unknown) {
    console.error("Resend invite error:", error);
    const message = (error as { message?: string } | null)?.message ?? "Failed to resend invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
