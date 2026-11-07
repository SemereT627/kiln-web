import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/validate";
import { getAdminEmails } from "@/lib/admin-emails";
import {
  sendEmail,
  siteUrl,
  requestReceivedEmail,
  adminNewRequestEmail,
} from "@/lib/email";

const MAX_REQUESTS_PER_HOUR = 10;

const requestSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  message: z.string().trim().max(500).optional().nullable(),
  // Honeypot — hidden from people, filled in by naive bots.
  website: z.string().optional(),
});

/**
 * Public "Request access" submission. Always answers with the same success
 * response (duplicates, bot submissions) so the endpoint can't be used to
 * probe which emails have pending requests.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, requestSchema);
  if ("response" in parsed) return parsed.response;
  const { fullName, email, message, website } = parsed.data;

  if (website) return NextResponse.json({ success: true });

  const supabase = await createServiceClient();

  // Throttle before writing: past this many requests an hour, store nothing
  // and send no email, so the form can't be used to spam inboxes from our
  // verified Resend domain. Same success answer either way.
  // shortcut: global (not per-IP) limit, move to Vercel Firewall rate limiting if real traffic ever hits it.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent } = await supabase
    .from("access_requests")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if ((recent ?? 0) >= MAX_REQUESTS_PER_HOUR) return NextResponse.json({ success: true });

  const { error } = await supabase
    .from("access_requests")
    .insert({ full_name: fullName, email, message: message || null });

  // 23505 = the one-pending-request-per-email unique index.
  if (error?.code === "23505") return NextResponse.json({ success: true });
  if (error) {
    console.error("POST access-requests error:", error);
    return NextResponse.json({ error: "Couldn't submit your request" }, { status: 500 });
  }

  // Best-effort notifications — a mail failure doesn't undo the request.
  const adminEmails = await getAdminEmails();

  await Promise.all([
    sendEmail({ to: email, ...requestReceivedEmail(fullName) }),
    adminEmails.length > 0 &&
      sendEmail({
        to: adminEmails,
        ...adminNewRequestEmail({
          fullName,
          email,
          message: message || null,
          reviewUrl: `${siteUrl(request)}/en/admin/users`,
        }),
      }),
  ]);

  return NextResponse.json({ success: true });
}
