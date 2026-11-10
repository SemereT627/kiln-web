import { msyncDb } from "./db";
import type { Device } from "./devices";
import { sha256 } from "./keys";
import { parseMessage } from "./parse";

export type IncomingSms = { sender: string; body: string; receivedAt: string };

/** Stores forwarded SMS, parsed. Duplicates (same text from the other phone,
 * a retried upload, or a bank reference already seen) are skipped, not errors. */
export async function ingestMessages(device: Device, messages: IncomingSms[]) {
  const db = msyncDb();
  let stored = 0;
  let duplicates = 0;
  for (const m of messages) {
    const parsed = parseMessage(m.sender, m.body);
    const { error } = await db.from("msync_messages").insert({
      tenant: device.tenant,
      device_id: device.id,
      sender: m.sender,
      body: m.body,
      received_at: m.receivedAt,
      fingerprint: sha256(`${m.sender}\n${m.body}`),
      ...parsed,
    });
    if (!error) stored++;
    else if (error.code === "23505") duplicates++;
    else throw error;
  }
  return { stored, duplicates };
}
