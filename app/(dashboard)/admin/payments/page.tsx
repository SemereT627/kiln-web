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
import { formatBirr, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { DashCard } from "@/components/dashboard/chart-card";
import { cn } from "@/lib/utils";

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
    <PageLayout
      aside={
        <>
        <PageHeader
          card
          title="Payments"
          description={<>Bank messages forwarded by the shop phones running mSync. A signal to cross-check — the bank statement is the final word.</>}
          actions={
            <>
              <Button asChild variant="outline">
                <a href={MSYNC_DASHBOARD} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Manage phones
                </a>
              </Button>
            </>
          }
        />
        {/* Phones: same card anatomy as the dashboard panels, one row per phone */}
        <DashCard
          icon={Smartphone}
          title="Phones"
          subtitle={phones.data ? `${phones.data.length} connected` : undefined}
          contentClassName="mt-2"
        >
          {phones.isLoading ? (
            <div className="space-y-2 pt-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : !phones.data?.length ? (
            <p className="pt-2 text-sm text-muted-foreground">No phones connected yet. Add one on the mSync dashboard.</p>
          ) : (
            <ul className="divide-y divide-dashed">
              {phones.data.map((p) => {
                const online = p.lastSeenAt && openedAt - new Date(p.lastSeenAt).getTime() < OFFLINE_AFTER_MS;
                const status = !p.paired
                  ? { label: "Pairing", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" }
                  : online
                    ? { label: "Online", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" }
                    : { label: "Offline", className: "bg-destructive/10 text-destructive", dot: "bg-destructive" };
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Smartphone className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {!p.paired
                          ? `Code expires ${formatDateTime(p.pairingExpiresAt!)}`
                          : p.lastSeenAt
                            ? `Seen ${formatDateTime(p.lastSeenAt)}${p.queued ? ` · ${p.queued} waiting` : ""}`
                            : "Paired, not seen yet"}
                      </p>
                    </div>
                    <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}>
                      <span className={cn("size-1.5 rounded-full", status.dot)} />
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </DashCard>
        </>
      }
    >


      <div className="min-h-0 overflow-auto rounded-[20px] bg-card">
        {payments.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : payments.error ? (
          <div className="p-6 text-sm text-destructive">{(payments.error as Error).message}</div>
        ) : !payments.data?.length ? (
          <EmptyState icon={Landmark} title="No bank messages yet" description="They appear here as soon as a connected phone receives one." />
        ) : (
          <Table containerClassName="overflow-visible">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky top-0 z-10 bg-card pl-5">Received</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card">Bank</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card text-right">Amount</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card">From</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card">Reference</TableHead>
                <TableHead className="sticky top-0 z-10 bg-card pr-5">Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.data.map((m) => (
                <TableRow key={m.id} className="cursor-pointer align-top" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                  <TableCell className="whitespace-nowrap pl-5">{formatDateTime(m.receivedAt)}</TableCell>
                  <TableCell>{m.bank ?? m.sender}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {m.amount === null ? (
                      "—"
                    ) : m.kind === "debit" ? (
                      // Money sent is not a payment received: marked and coloured apart.
                      <span className="text-destructive">−{formatBirr(Number(m.amount), m.currency ?? "ETB")}</span>
                    ) : (
                      formatBirr(Number(m.amount), m.currency ?? "ETB")
                    )}
                  </TableCell>
                  <TableCell className="min-w-48 max-w-xs whitespace-normal break-words">
                    {m.kind === "unparsed" || expanded === m.id ? (
                      <span className={expanded === m.id ? "whitespace-pre-wrap text-sm" : "line-clamp-2 text-sm text-muted-foreground"}>
                        {expanded === m.id ? m.body : m.payer ?? m.body}
                      </span>
                    ) : (
                      m.payer ?? "—"
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.reference ?? "—"}</TableCell>
                  <TableCell className="pr-5 text-muted-foreground">{m.phone ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

    </PageLayout>
  );
}
