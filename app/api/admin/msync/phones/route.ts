import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listPhones } from "@/lib/msync/client";

// Read-only here: phones are added and removed on the mSync dashboard.
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ data: await listPhones() });
}
