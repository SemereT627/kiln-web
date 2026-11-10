import { msyncDb } from "./db";
export { createPairing, revokeDevice } from "./devices";

/**
 * The only door the host app (Kiln) uses into mSync. After a split into its
 * own service, these become HTTP calls and nothing in the host changes.
 */
export type Payment = {
  id: string;
  deviceLabel: string | null;
  sender: string;
  body: string;
  receivedAt: string;
  kind: "credit" | "other" | "unparsed";
  bank: string | null;
  amount: number | null;
  currency: string | null;
  payer: string | null;
  reference: string | null;
};

export type PhoneStatus = {
  id: string;
  label: string;
  paired: boolean;
  pairingExpiresAt: string | null;
  lastSeenAt: string | null;
  appVersion: string | null;
  queued: number | null;
};

export async function listPayments(tenant: string, limit = 200): Promise<Payment[]> {
  const { data, error } = await msyncDb()
    .from("msync_messages")
    .select("id, sender, body, received_at, kind, bank, amount, currency, payer, reference, device:msync_devices(label)")
    .eq("tenant", tenant)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    deviceLabel: (m.device as unknown as { label: string } | null)?.label ?? null,
    sender: m.sender,
    body: m.body,
    receivedAt: m.received_at,
    kind: m.kind,
    bank: m.bank,
    amount: m.amount === null ? null : Number(m.amount),
    currency: m.currency,
    payer: m.payer,
    reference: m.reference,
  }));
}

export async function listPhones(tenant: string): Promise<PhoneStatus[]> {
  const { data, error } = await msyncDb()
    .from("msync_devices")
    .select("id, label, paired_at, pair_expires_at, last_seen_at, app_version, queued")
    .eq("tenant", tenant)
    .is("revoked_at", null)
    .order("created_at");
  if (error) throw error;
  const now = Date.now();
  return (data ?? [])
    // Unredeemed codes past their expiry are just clutter.
    .filter((d) => d.paired_at || (d.pair_expires_at && new Date(d.pair_expires_at).getTime() > now))
    .map((d) => ({
      id: d.id,
      label: d.label,
      paired: !!d.paired_at,
      pairingExpiresAt: d.paired_at ? null : d.pair_expires_at,
      lastSeenAt: d.last_seen_at,
      appVersion: d.app_version,
      queued: d.queued,
    }));
}
