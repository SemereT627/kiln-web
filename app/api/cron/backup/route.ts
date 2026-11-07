import { NextResponse } from "next/server";
import { runBackup } from "@/lib/backup";
import { getAdminEmails } from "@/lib/admin-emails";
import { backupFailedEmail, sendEmail, siteUrl } from "@/lib/email";

// Vercel Cron (vercel.json) calls this daily with `Authorization: Bearer $CRON_SECRET`.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runBackup());
  } catch (error) {
    console.error("Scheduled backup failed:", error);
    const to = await getAdminEmails().catch(() => []);
    if (to.length > 0) {
      await sendEmail({
        to,
        ...backupFailedEmail({
          error: error instanceof Error ? error.message : String(error),
          backupsUrl: `${siteUrl(request)}/en/admin/backups`,
        }),
      });
    }
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
