"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Landmark, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import type { Payment, PhoneStatus } from "@/lib/msync/client";
import { formatDateTime, formatNumber } from "@/lib/utils";

const paymentsKey = ["admin", "msync", "payments"];
const phonesKey = ["admin", "msync", "phones"];
const MSYNC_DASHBOARD = "https://msync.semere.app";
// A phone checks in every ~15 minutes; past this it's probably not forwarding.
const OFFLINE_AFTER_MS = 40 * 60 * 1000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Couldn't load");
  return json.data;
}

export default function PaymentsPage() {
  const [openedAt] = useState(() => Date.now());
  const [expanded, setExpanded] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);

  // mSync has no realtime: poll, and toast when a new message shows up.
  const payments = useQuery({
    queryKey: paymentsKey,
    queryFn: () => getJson<Payment[]>("/api/admin/msync/payments"),
    refetchInterval: 30_000,
  });
  const phones = useQuery({
    queryKey: phonesKey,
    queryFn: () => getJson<PhoneStatus[]>("/api/admin/msync/phones"),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!payments.data) return;
    if (seen.current && payments.data.some((m) => !seen.current!.has(m.id))) toast.info("Bank message received");
    seen.current = new Set(payments.data.map((m) => m.id));
  }, [payments.data]);

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Payments</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Bank messages forwarded by the shop phones running mSync. A signal to cross-check — the bank statement is the final word.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={MSYNC_DASHBOARD} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Manage phones
          </a>
        </Button>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {phones.isLoading ? (
          <Skeleton className="h-14 w-64" />
        ) : !phones.data?.length ? (
          <p className="text-sm text-muted-foreground">No phones connected yet. Add one on the mSync dashboard.</p>
        ) : (
          phones.data.map((p) => {
            const online = p.lastSeenAt && openedAt - new Date(p.lastSeenAt).getTime() < OFFLINE_AFTER_MS;
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <Smartphone className="size-4 text-muted-foreground" />
                <div className="text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    {p.label}
                    <span
                      className={
                        !p.paired
                          ? "size-2 rounded-full bg-amber-500"
                          : online
                            ? "size-2 rounded-full bg-emerald-500"
                            : "size-2 rounded-full bg-destructive"
                      }
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {!p.paired
                      ? `Waiting to pair — code expires ${formatDateTime(p.pairingExpiresAt!)}`
                      : p.lastSeenAt
                        ? `Last seen ${formatDateTime(p.lastSeenAt)}${p.queued ? ` · ${p.queued} waiting` : ""}`
                        : "Paired, not seen yet"}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex-1 overflow-auto rounded-lg border">
        {payments.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : payments.error ? (
          <div className="p-6 text-sm text-destructive">{(payments.error as Error).message}</div>
        ) : !payments.data?.length ? (
          <EmptyState icon={Landmark} title="No bank messages yet" description="They appear here as soon as a connected phone receives one." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data.map((m) => (
                <TableRow key={m.id} className="cursor-pointer align-top" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(m.receivedAt)}</TableCell>
                  <TableCell>{m.bank ?? m.sender}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {m.amount !== null ? `${m.currency ?? "ETB"} ${formatNumber(m.amount)}` : "—"}
                  </TableCell>
                  <TableCell className="max-w-md">
                    {m.kind === "unparsed" || expanded === m.id ? (
                      <span className={expanded === m.id ? "whitespace-pre-wrap text-sm" : "line-clamp-2 text-sm text-muted-foreground"}>
                        {expanded === m.id ? m.body : m.payer ?? m.body}
                      </span>
                    ) : (
                      m.payer ?? "—"
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.reference ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.deviceLabel ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

    </div>
  );
}
