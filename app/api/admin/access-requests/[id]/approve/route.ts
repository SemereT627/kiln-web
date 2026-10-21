import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { createAndSendInvite } from "@/lib/access-invite";

// Admin is deliberately not offered here — there's a single-admin constraint,
// and promotion goes through the Users table like any other role change.
const approveSchema = z.object({
  role: z.enum(["seller", "viewer"]),
});

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
    const parsed = await parseBody(request, approveSchema);
    if ("response" in parsed) return parsed.response;
    const { role } = parsed.data;

    const supabase = await createServiceClient();

    const { data: req } = await supabase
      .from("access_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (!req || req.status !== "pending") {
      return NextResponse.json({ error: "Only pending requests can be approved" }, { status: 400 });
    }

    // Creates the auth user (handle_new_user() then creates a viewer profile).
    const { user, emailSent, error } = await createAndSendInvite(supabase, request, {
      type: "invite",
      email: req.email,
      fullName: req.full_name,
      role,
    });
    if (error || !user) {
      const alreadyExists = /already.*(registered|exists)/i.test(error ?? "");
      return NextResponse.json(
        {
          error: alreadyExists
            ? "An account with this email already exists. Reject this request and manage the existing user instead."
            : error,
        },
        { status: alreadyExists ? 409 : 500 },
      );
    }

    if (role !== "viewer") {
      const { error: roleError } = await supabase
        .from("user_profiles")
        .update({ role })
        .eq("id", user.id);
      if (roleError) {
        return NextResponse.json({ error: roleError.message }, { status: 500 });
      }
    }

    const { error: updateError } = await supabase
      .from("access_requests")
      .update({
        status: "approved",
        role,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        user_id: user.id,
      })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await logAudit({
      actor: admin,
      action: "access_request.approve",
      targetTable: "access_requests",
      targetId: id,
      before: { status: "pending" },
      after: { status: "approved", role, email: req.email, userId: user.id },
    });

    return NextResponse.json({ success: true, emailSent });
  } catch (error: unknown) {
    console.error("Approve access request error:", error);
    const message = (error as { message?: string } | null)?.message ?? "Failed to approve request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
