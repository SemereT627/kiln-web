import { NextResponse } from "next/server";
import { authenticateDevice, revokeDevice } from "@/lib/msync/devices";

/** The phone disconnects itself: its key stops working and it leaves the dashboard. */
export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) return NextResponse.json({ error: "Unknown or revoked device" }, { status: 401 });
  await revokeDevice(device.tenant, device.id);
  return NextResponse.json({ ok: true });
}
