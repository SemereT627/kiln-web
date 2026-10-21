import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, siteUrl, inviteEmail } from "@/lib/email";

/**
 * Creates (type "invite") or re-links (type "recovery", for an already-created
 * user whose first link expired) a Supabase auth link WITHOUT Supabase sending
 * its own email, then sends our Resend invite instead. The link points at
 * /api/auth/confirm, which verifies the token server-side and drops the user
 * on /set-password with a session.
 */
export async function createAndSendInvite(
  supabase: SupabaseClient,
  request: Request,
  {
    type,
    email,
    fullName,
    role,
  }: { type: "invite" | "recovery"; email: string; fullName: string; role: string },
) {
  const { data, error } =
    type === "invite"
      ? await supabase.auth.admin.generateLink({
          type: "invite",
          email,
          options: { data: { full_name: fullName } },
        })
      : await supabase.auth.admin.generateLink({ type: "recovery", email });

  if (error || !data.user || !data.properties?.hashed_token) {
    return { user: null, emailSent: false, error: error?.message ?? "Couldn't create the invite link" };
  }

  const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type });
  const inviteUrl = `${siteUrl(request)}/api/auth/confirm?${params.toString()}`;
  const { ok } = await sendEmail({ to: email, ...inviteEmail({ fullName, role, inviteUrl }) });

  return { user: data.user, emailSent: ok, error: null };
}
