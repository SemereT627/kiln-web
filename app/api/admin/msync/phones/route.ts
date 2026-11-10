import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { createPairing, listPhones } from "@/lib/msync/client";
import { MSYNC_TENANT } from "@/lib/msync-tenant";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ data: await listPhones(MSYNC_TENANT) });
}

const schema = z.object({ label: z.string().trim().min(1, "Name the phone").max(40) });

/** "Add phone": returns a one-time pairing code to type into mSync. */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  const pairing = await createPairing(MSYNC_TENANT, parsed.data.label, admin.email ?? admin.id);
  await logAudit({
    actor: admin,
    action: "msync.phone.pair_code",
    targetTable: "msync_devices",
    targetId: pairing.deviceId,
    after: { label: parsed.data.label },
  });
  return NextResponse.json(pairing, { status: 201 });
}
