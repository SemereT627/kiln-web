import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDevice, recordHeartbeat } from "@/lib/msync/devices";
import { BANK_SENDERS } from "@/lib/msync/parse";

const schema = z.object({
  appVersion: z.string().max(40).nullable().optional(),
  queued: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

/** "I'm alive" from a phone, so the dashboard can show when forwarding stops. */
export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) return NextResponse.json({ error: "Unknown or revoked device" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await recordHeartbeat(device, parsed.data.appVersion ?? null, parsed.data.queued ?? null);
  return NextResponse.json({ ok: true, label: device.label, senders: BANK_SENDERS });
}
