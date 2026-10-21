import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/validate";
import {
  sendEmail,
  siteUrl,
  requestReceivedEmail,
  adminNewRequestEmail,
} from "@/lib/email";

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
  const { data: admins } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("role", "admin");
  const adminEmails = (
    await Promise.all(
      (admins ?? []).map(async (a) => {
        const { data } = await supabase.auth.admin.getUserById(a.id);
        return data?.user?.email ?? null;
      }),
    )
  ).filter((e): e is string => !!e);

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
