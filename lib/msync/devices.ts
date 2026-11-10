import { msyncDb } from "./db";
import { newDeviceKey, newPairCode, normalizePairCode, PAIR_CODE_TTL_MS, sha256 } from "./keys";

export type Device = { id: string; tenant: string; label: string };

/** Admin starts pairing: a device row with a one-time code (only its hash is stored). */
export async function createPairing(tenant: string, label: string, createdBy: string | null) {
  const code = newPairCode();
  const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_MS).toISOString();
  const { data, error } = await msyncDb()
    .from("msync_devices")
    .insert({ tenant, label, pair_code_hash: sha256(code), pair_expires_at: expiresAt, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  return { deviceId: data.id as string, code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt };
}

/** Phone redeems the code for its long-lived key. Codes are single use. */
export async function pairDevice(code: string, appVersion: string | null) {
  const db = msyncDb();
  const { data: device } = await db
    .from("msync_devices")
    .select("id, tenant, label, pair_expires_at, revoked_at")
    .eq("pair_code_hash", sha256(normalizePairCode(code)))
    .maybeSingle();
  if (!device || device.revoked_at || new Date(device.pair_expires_at).getTime() < Date.now()) return null;

  const key = newDeviceKey();
  const { data: updated, error } = await db
    .from("msync_devices")
    .update({
      token_hash: sha256(key),
      pair_code_hash: null,
      pair_expires_at: null,
      paired_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      app_version: appVersion,
    })
    .eq("id", device.id)
    .not("pair_code_hash", "is", null) // lost race: a second redeem updates nothing
    .select("id");
  if (error) throw error;
  if (!updated?.length) return null;
  return { deviceId: device.id as string, tenant: device.tenant as string, label: device.label as string, key };
}

/** Resolves `Authorization: Bearer msk_...` to a paired, non-revoked device. */
export async function authenticateDevice(request: Request): Promise<Device | null> {
  const key = request.headers.get("authorization")?.match(/^Bearer (msk_[\w-]+)$/)?.[1];
  if (!key) return null;
  const { data } = await msyncDb()
    .from("msync_devices")
    .select("id, tenant, label, revoked_at")
    .eq("token_hash", sha256(key))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  return { id: data.id, tenant: data.tenant, label: data.label };
}

export async function recordHeartbeat(device: Device, appVersion: string | null, queued: number | null) {
  await msyncDb()
    .from("msync_devices")
    .update({ last_seen_at: new Date().toISOString(), app_version: appVersion, queued })
    .eq("id", device.id);
}

export async function revokeDevice(tenant: string, deviceId: string) {
  const { error } = await msyncDb()
    .from("msync_devices")
    .update({ revoked_at: new Date().toISOString(), token_hash: null, pair_code_hash: null })
    .eq("id", deviceId)
    .eq("tenant", tenant);
  if (error) throw error;
}
