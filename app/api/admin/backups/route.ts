import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { listBackups, runBackup } from "@/lib/backup";

export const maxDuration = 300;

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ data: await listBackups() });
  } catch (error) {
    console.error("List backups failed:", error);
    return NextResponse.json({ error: "Couldn't reach the backup store" }, { status: 500 });
  }
}

/** "Back up now". */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const result = await runBackup();
    await logAudit({
      actor: admin,
      action: "backup.create",
      targetTable: "backups",
      targetId: result.pathname,
      after: result,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Manual backup failed:", error);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
