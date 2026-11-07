"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Download, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/utils";

type Backup = { pathname: string; size: number; uploadedAt: string };
type RestoreReport = {
  tables: Record<string, { restored: number; failed: number }>;
  imagesRestored: number;
};

const backupsKey = ["admin", "backups"];

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json;
}

export default function BackupsPage() {
  const queryClient = useQueryClient();
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport] = useState<RestoreReport | null>(null);
  const [openedAt] = useState(() => Date.now());

  const { data: backups, isLoading, error } = useQuery<Backup[]>({
    queryKey: backupsKey,
    queryFn: async () => {
      const res = await fetch("/api/admin/backups");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't load backups");
      return json.data;
    },
  });

  const backupNow = useMutation({
    mutationFn: () => postJson("/api/admin/backups"),
    onSuccess: () => {
      setMessage({ ok: true, text: "Backup saved." });
      queryClient.invalidateQueries({ queryKey: backupsKey });
    },
    onError: (e: Error) => setMessage({ ok: false, text: e.message }),
  });

  const restore = useMutation({
    mutationFn: (path: string) => postJson("/api/admin/backups/restore", { path }) as Promise<RestoreReport>,
    onSuccess: (r) => {
      setReport(r);
      const restored = Object.values(r.tables).reduce((a, t) => a + t.restored, 0);
      setMessage({
        ok: true,
        text: restored + r.imagesRestored === 0
          ? "Nothing was missing — the data already matches this backup."
          : `Put back ${restored} rows and ${r.imagesRestored} images.`,
      });
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => setMessage({ ok: false, text: e.message }),
  });

  const busy = backupNow.isPending || restore.isPending;
  // Nightly job + an hour of cron slack + margin: older than this means it's not running.
  const stale =
    !!backups?.length && openedAt - new Date(backups[0].uploadedAt).getTime() > 36 * 60 * 60 * 1000;
  const changedTables = report
    ? Object.entries(report.tables).filter(([, t]) => t.restored > 0 || t.failed > 0)
    : [];

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Backups</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            A copy of all data and product images is saved off-site every night and kept for 30 days.
          </p>
        </div>
        <Button onClick={() => { setMessage(null); backupNow.mutate(); }} disabled={busy}>
          {backupNow.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Back up now
        </Button>
      </div>

      {stale && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            The latest backup is from {formatDateTime(backups![0].uploadedAt)} — the nightly backup hasn&apos;t run since.
            Click “Back up now”, and check the Vercel cron job.
          </span>
        </div>
      )}

      {message && (
        <div
          className={
            message.ok
              ? "flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400"
              : "flex items-start gap-2 rounded-lg border border-destructive/15 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
          }
        >
          {message.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          <div>
            <p>{message.text}</p>
            {changedTables.length > 0 && (
              <ul className="mt-1 text-xs text-muted-foreground">
                {changedTables.map(([table, t]) => (
                  <li key={table}>
                    {table}: {t.restored} restored{t.failed > 0 && `, ${t.failed} couldn't be restored`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-lg border">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>
        ) : !backups?.length ? (
          <EmptyState
            icon={Save}
            title="No backups yet"
            description="The first one runs tonight, or click “Back up now”."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Taken</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((b, i) => (
                <TableRow key={b.pathname}>
                  <TableCell className="font-medium">
                    {formatDateTime(b.uploadedAt)}
                    {i === 0 && <span className="ml-2 text-xs text-muted-foreground">latest</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatSize(b.size)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/admin/backups/download?path=${encodeURIComponent(b.pathname)}`} download>
                          <Download className="size-4" />
                          Download
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => setRestoreTarget(b)}>
                        {restore.isPending && restore.variables === b.pathname ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                        Restore deleted
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        title="Restore deleted data?"
        description={`Puts back anything that was in the backup from ${restoreTarget ? formatDateTime(restoreTarget.uploadedAt) : ""} but has since been deleted. Nothing that exists now is changed or removed.`}
        confirmLabel="Restore"
        onConfirm={() => {
          if (!restoreTarget) return;
          setMessage(null);
          setReport(null);
          restore.mutate(restoreTarget.pathname);
          setRestoreTarget(null);
        }}
      />
    </div>
  );
}
