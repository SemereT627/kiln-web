"use client";

import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Landmark, Loader2, Plus, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPayments } from "@/lib/msync/live";
import type { Payment, PhoneStatus } from "@/lib/msync/client";
import { formatDateTime, formatNumber } from "@/lib/utils";

const paymentsKey = ["admin", "msync", "payments"];
const phonesKey = ["admin", "msync", "phones"];
// A phone checks in every ~15 minutes; past this it's probably not forwarding.
const OFFLINE_AFTER_MS = 40 * 60 * 1000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Couldn't load");
  return json.data;
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const channelId = useId();
  const [openedAt] = useState(() => Date.now());
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PhoneStatus | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const payments = useQuery({ queryKey: paymentsKey, queryFn: () => getJson<Payment[]>("/api/admin/msync/payments") });
  const phones = useQuery({
    queryKey: phonesKey,
    queryFn: () => getJson<PhoneStatus[]>("/api/admin/msync/phones"),
    refetchInterval: 60_000,
  });

  useEffect(
    () =>
      subscribeToPayments(createClient(), `msync-payments-${channelId}`, () => {
        queryClient.invalidateQueries({ queryKey: paymentsKey });
        queryClient.invalidateQueries({ queryKey: phonesKey });
        toast.info("Bank message received");
      }),
    [queryClient, channelId],
  );

  const addPhone = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/msync/phones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't create a code");
      return json as { code: string; expiresAt: string };
    },
    onSuccess: (p) => {
      setPairing(p);
      queryClient.invalidateQueries({ queryKey: phonesKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePhone = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/msync/phones/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove the phone");
    },
    onSuccess: () => {
      toast.success("Phone removed — it can no longer send messages");
      queryClient.invalidateQueries({ queryKey: phonesKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function closeAdd(open: boolean) {
    setAddOpen(open);
    if (!open) {
      setLabel("");
      setPairing(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Payments</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Bank messages forwarded by the shop phones running mSync. A signal to cross-check — the bank statement is the final word.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add phone
        </Button>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {phones.isLoading ? (
          <Skeleton className="h-14 w-64" />
        ) : !phones.data?.length ? (
          <p className="text-sm text-muted-foreground">No phones connected yet.</p>
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
                <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove ${p.label}`} onClick={() => setRemoveTarget(p)}>
                  <Trash2 className="size-3.5" />
                </Button>
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

      <Dialog open={addOpen} onOpenChange={closeAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pairing ? "Enter this in mSync" : "Add a phone"}</DialogTitle>
            <DialogDescription>
              {pairing
                ? "Open mSync on the phone and enter the server and code below. The code works once and expires in 10 minutes."
                : "Give the phone a name you'll recognise, e.g. “Owner phone”."}
            </DialogDescription>
          </DialogHeader>
          {pairing ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Server</div>
                <div className="font-mono text-sm select-all">{typeof window !== "undefined" ? window.location.origin : ""}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Code</div>
                <div className="font-mono text-3xl font-semibold tracking-widest select-all">{pairing.code}</div>
              </div>
            </div>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                addPhone.mutate();
              }}
            >
              <Label htmlFor="phoneLabel">Phone name</Label>
              <Input id="phoneLabel" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} autoFocus />
            </form>
          )}
          <DialogFooter>
            {pairing ? (
              <Button onClick={() => closeAdd(false)}>Done</Button>
            ) : (
              <Button onClick={() => addPhone.mutate()} disabled={!label.trim() || addPhone.isPending}>
                {addPhone.isPending && <Loader2 className="size-4 animate-spin" />}
                Get pairing code
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.label ?? "phone"}?`}
        description="Its key stops working immediately and it can no longer send messages. Messages it already sent stay. You can pair it again with a new code."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (removeTarget) removePhone.mutate(removeTarget.id);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}
