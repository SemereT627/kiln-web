import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revokeDevice } from "@/lib/msync/client";
import { MSYNC_TENANT } from "@/lib/msync-tenant";

/** Removes a phone: its key stops working immediately. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await revokeDevice(MSYNC_TENANT, id);
  await logAudit({ actor: admin, action: "msync.phone.revoke", targetTable: "msync_devices", targetId: id });
  return NextResponse.json({ ok: true });
}
