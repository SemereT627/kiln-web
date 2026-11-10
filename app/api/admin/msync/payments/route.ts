import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listPayments } from "@/lib/msync/client";
import { MSYNC_TENANT } from "@/lib/msync-tenant";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ data: await listPayments(MSYNC_TENANT) });
}
