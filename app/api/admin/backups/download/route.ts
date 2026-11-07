import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isBackupPath, openBackup } from "@/lib/backup";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isBackupPath(path)) return NextResponse.json({ error: "Invalid backup" }, { status: 400 });

  const stream = await openBackup(path);
  if (!stream) return NextResponse.json({ error: "Backup not found" }, { status: 404 });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${path.slice("backups/".length)}"`,
      "Cache-Control": "no-store",
    },
  });
}
