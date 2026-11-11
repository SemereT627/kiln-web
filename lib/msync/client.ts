/**
 * The only door the host app (Kiln) uses into mSync, which now runs as its own
 * service (msync-web). Server-side only: the project API key never reaches the browser.
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

async function get<T>(path: string): Promise<T> {
  const url = process.env.MSYNC_URL;
  const key = process.env.MSYNC_API_KEY;
  if (!url || !key) throw new Error("MSYNC_URL and MSYNC_API_KEY must be set");
  const res = await fetch(`${url.replace(/\/+$/, "")}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`mSync answered ${res.status}`);
  return res.json();
}

export const listPayments = (limit = 200) => get<Payment[]>(`/api/v1/payments?limit=${limit}`);

export const listPhones = () => get<PhoneStatus[]>("/api/v1/phones");
