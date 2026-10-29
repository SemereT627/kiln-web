import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { z } from "zod";

const resetSchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

/**
 * DELETE /api/admin/users/mfa — removes every authenticator factor for a
 * user (e.g. lost phone). Their next web sign-in walks them through setting
 * one up again. Admins can't reset their own; use scripts/reset-mfa.mjs.
 */
export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(request, resetSchema);
  if ("response" in parsed) return parsed.response;
  const { userId } = parsed.data;

  if (userId === admin.id) {
    return NextResponse.json(
      { error: "You can't reset your own two-step sign-in here" },
      { status: 400 },
    );
  }

  const serviceSupabase = await createServiceClient();
  const { data, error } = await serviceSupabase.auth.admin.mfa.listFactors({ userId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const factor of data.factors) {
    const { error: deleteError } = await serviceSupabase.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId,
    });
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  await logAudit({
    actor: admin,
    action: "user.mfa_reset",
    targetTable: "user_profiles",
    targetId: userId,
    before: { factorCount: data.factors.length },
    after: { factorCount: 0 },
  });

  return NextResponse.json({ success: true, removed: data.factors.length });
}
