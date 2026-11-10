import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDevice } from "@/lib/msync/devices";
import { ingestMessages } from "@/lib/msync/ingest";

const schema = z.object({
  messages: z
    .array(
      z.object({
        sender: z.string().min(1).max(50),
        body: z.string().min(1).max(2000),
        receivedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
      }),
    )
    .max(100),
});

/** A paired phone uploads bank SMS (batch, retry-safe). */
export async function POST(request: Request) {
  const device = await authenticateDevice(request);
  if (!device) return NextResponse.json({ error: "Unknown or revoked device" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    return NextResponse.json(await ingestMessages(device, parsed.data.messages));
  } catch (error) {
    console.error("msync ingest failed", device.id, error);
    return NextResponse.json({ error: "Couldn't store messages" }, { status: 500 });
  }
}
