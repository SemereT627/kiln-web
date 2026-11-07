import { gunzipSync, gzipSync } from "node:zlib";
import { del, get, list, put } from "@vercel/blob";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Daily off-site backups to a private Vercel Blob store (outside Supabase,
 * so a lost or broken Supabase project doesn't take the backups with it).
 *
 * - backups/kiln-<timestamp>.json.gz — every public table, one gzipped JSON
 * - images/<path> — product images, copied once each (they rarely change)
 *
 * Not covered: Supabase Auth accounts (auth.users) — people would need to be
 * re-invited after a full project loss; their profiles/roles are in the dump.
 */

/** Parents before children, so a restore never inserts a row before what it references. */
export const BACKUP_TABLES = [
  "brands",
  "finishes",
  "ceramic_types",
  "ceramics",
  "user_profiles",
  "stock_entries",
  "sales",
  "orders",
  "order_items",
  "returns",
  "return_items",
  "return_requests",
  "return_request_items",
  "access_requests",
  "audit_logs",
] as const;

const IMAGE_BUCKET = "ceramic-images";
const RETENTION_DAYS = 30;
const PAGE = 1000;

type Row = Record<string, unknown>;
export type BackupFile = {
  version: 1;
  createdAt: string;
  tables: Record<string, Row[]>;
  images: string[];
};

export type BackupSummary = { pathname: string; size: number; uploadedAt: string };

export function isBackupPath(pathname: string) {
  return /^backups\/kiln-[\w-]+\.json\.gz$/.test(pathname);
}

async function readTable(supabase: Awaited<ReturnType<typeof createServiceClient>>, table: string) {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function listImagePaths(supabase: Awaited<ReturnType<typeof createServiceClient>>, prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`images: ${error.message}`);
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders come back without an id.
      if (entry.id) paths.push(path);
      else paths.push(...(await listImagePaths(supabase, path)));
    }
    if (!data || data.length < PAGE) return paths;
  }
}

async function listBlobPaths(prefix: string) {
  const paths: { pathname: string; size: number; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor });
    paths.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return paths;
}

/** Dumps every table + copies new images, then prunes old dumps. */
export async function runBackup() {
  const supabase = await createServiceClient();

  const tables: Record<string, Row[]> = {};
  for (const table of BACKUP_TABLES) tables[table] = await readTable(supabase, table);

  // Copy only images not already in the store.
  const images = await listImagePaths(supabase);
  const stored = new Set((await listBlobPaths("images/")).map((b) => b.pathname));
  const toCopy = images.filter((path) => !stored.has(`images/${path}`));
  // 8 at a time: a first run copying every image must fit the 300s function limit.
  for (let i = 0; i < toCopy.length; i += 8) {
    await Promise.all(
      toCopy.slice(i, i + 8).map(async (path) => {
        const { data, error } = await supabase.storage.from(IMAGE_BUCKET).download(path);
        if (error || !data) throw new Error(`image ${path}: ${error?.message ?? "missing"}`);
        await put(`images/${path}`, data, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: data.type || undefined,
        });
      }),
    );
  }
  const imagesCopied = toCopy.length;

  const createdAt = new Date().toISOString();
  const file: BackupFile = { version: 1, createdAt, tables, images };
  const pathname = `backups/kiln-${createdAt.replace(/[:.]/g, "-")}.json.gz`;
  const body = gzipSync(JSON.stringify(file));
  await put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/gzip",
  });

  // Read it back and check every table's row count, so a backup that can't
  // be opened is reported as a failure tonight, not discovered at restore time.
  const check = await readBackup(pathname);
  for (const table of BACKUP_TABLES) {
    if (check.tables[table]?.length !== tables[table].length) {
      throw new Error(`Backup ${pathname} failed verification (${table})`);
    }
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const expired = (await listBlobPaths("backups/")).filter((b) => b.uploadedAt.getTime() < cutoff);
  if (expired.length > 0) await del(expired.map((b) => b.pathname));

  return {
    pathname,
    size: body.length,
    rows: Object.fromEntries(Object.entries(tables).map(([t, r]) => [t, r.length])),
    imagesCopied,
    pruned: expired.length,
  };
}

export async function listBackups(): Promise<BackupSummary[]> {
  return (await listBlobPaths("backups/"))
    .filter((b) => isBackupPath(b.pathname))
    .map((b) => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt.toISOString() }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** Raw gzipped backup, for downloads. */
export async function openBackup(pathname: string) {
  const result = await get(pathname, { access: "private", useCache: false });
  return result?.statusCode === 200 ? result.stream : null;
}

async function readBackup(pathname: string): Promise<BackupFile> {
  const stream = await openBackup(pathname);
  if (!stream) throw new Error("Backup not found");
  const buffer = Buffer.from(await new Response(stream).arrayBuffer());
  const file = JSON.parse(gunzipSync(buffer).toString("utf8")) as BackupFile;
  if (file.version !== 1 || typeof file.tables !== "object") throw new Error("Unrecognised backup file");
  return file;
}

export type RestoreReport = {
  tables: Record<string, { restored: number; failed: number }>;
  imagesRestored: number;
};

/**
 * Puts back rows that exist in the backup but are missing now (matched by
 * id). Rows that still exist are left untouched, so later edits and new data
 * are never overwritten — this undoes deletions, not edits. Database checks
 * still apply (e.g. a deleted sale is only restored if the stock allows it);
 * rows they reject are counted as failed.
 */
export async function restoreMissingRows(pathname: string): Promise<RestoreReport> {
  const file = await readBackup(pathname);
  const supabase = await createServiceClient();
  const report: RestoreReport = { tables: {}, imagesRestored: 0 };

  for (const table of BACKUP_TABLES) {
    const rows = file.tables[table] ?? [];
    const existing = new Set((await readTable(supabase, table)).map((r) => r.id));
    const missing = rows.filter((r) => !existing.has(r.id));
    let restored = 0;
    let failed = 0;
    // One row at a time: a single rejected row (e.g. its user account is
    // gone) must not block the rest.
    for (const row of missing) {
      const { error } = await supabase.from(table).insert(row);
      if (error) failed++;
      else restored++;
    }
    report.tables[table] = { restored, failed };
  }

  const present = new Set(await listImagePaths(supabase));
  for (const path of file.images ?? []) {
    if (present.has(path)) continue;
    const blob = await get(`images/${path}`, { access: "private" });
    if (blob?.statusCode !== 200) continue;
    const bytes = await new Response(blob.stream).arrayBuffer();
    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, bytes, { contentType: blob.blob.contentType, upsert: false });
    if (!error) report.imagesRestored++;
  }

  return report;
}
