import { NextResponse } from "next/server";
import { runBackup } from "@/lib/backup";

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
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
