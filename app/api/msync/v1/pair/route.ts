import { NextResponse } from "next/server";
import { z } from "zod";
import { pairDevice } from "@/lib/msync/devices";
import { BANK_SENDERS } from "@/lib/msync/parse";

const schema = z.object({ code: z.string().min(4).max(20), appVersion: z.string().max(40).nullable().optional() });

/** mSync phone redeems a one-time code from the dashboard for its device key. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = await pairDevice(parsed.data.code, parsed.data.appVersion ?? null);
  if (!result) {
    return NextResponse.json({ error: "Code not recognised or expired. Create a new one." }, { status: 400 });
  }
  return NextResponse.json({ ...result, senders: BANK_SENDERS });
}
