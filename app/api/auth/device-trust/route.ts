import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { TRUSTED_DEVICE_COOKIE, TRUSTED_DEVICE_DAYS } from "@/lib/device-trust";

/**
 * POST /api/auth/device-trust { trust: boolean } — called right after the
 * two-step code: trust this browser for 30 days (no inactivity sign-out), or
 * clear an earlier trust when the box is unticked. requireUser needs an
 * aal2 web session, so only a fully signed-in user can set it.
 */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trust } = (await request.json().catch(() => ({}))) as { trust?: boolean };
  const res = NextResponse.json({ ok: true });
  if (!trust) {
    res.cookies.delete(TRUSTED_DEVICE_COOKIE);
    return res;
  }
  const maxAge = TRUSTED_DEVICE_DAYS * 24 * 60 * 60;
  res.cookies.set(TRUSTED_DEVICE_COOKIE, String(Date.now() + maxAge * 1000), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
}
