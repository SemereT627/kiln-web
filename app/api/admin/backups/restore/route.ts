import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseBody } from "@/lib/validate";
import { isBackupPath, restoreMissingRows } from "@/lib/backup";

export const maxDuration = 300;

const schema = z.object({
  path: z.string().refine(isBackupPath, "Invalid backup"),
});

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  try {
    const report = await restoreMissingRows(parsed.data.path);
    await logAudit({
      actor: admin,
      action: "backup.restore",
      targetTable: "backups",
      targetId: parsed.data.path,
      after: report,
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error("Restore failed:", error);
    return NextResponse.json({ error: "Restore failed" }, { status: 500 });
  }
}
