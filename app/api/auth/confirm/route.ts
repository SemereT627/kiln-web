import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for invite / re-invite links emailed by Resend. Verifies the
 * one-time token server-side (which sets the session cookie) and sends the
 * user on to choose a password. Lives under /api so the proxy doesn't
 * locale-prefix it or bounce the not-yet-signed-in visitor to /login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && (type === "invite" || type === "recovery")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}/en/set-password`);
    }
    console.error("auth/confirm: verifyOtp failed", error);
  }

  return NextResponse.redirect(`${origin}/login?error=invite_invalid`);
}
