"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, MailWarning, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn, formatDate } from "@/lib/utils";

type ApproveRole = "seller" | "viewer";

export interface AccessRequest {
  id: string;
  fullName: string;
  email: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  role: ApproveRole | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const accessRequestsKey = (status: "pending" | "approved") =>
  ["admin", "access-requests", status] as const;

async function fetchRequests(status: "pending" | "approved") {
  const res = await fetch(`/api/admin/access-requests?status=${status}&limit=${status === "pending" ? 50 : 10}`);
  if (!res.ok) throw new Error("Failed to load access requests");
  return (await res.json()) as AccessRequest[];
}

async function postAction(id: string, action: "approve" | "reject" | "resend", body?: unknown) {
  const res = await fetch(`/api/admin/access-requests/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as { success: boolean; emailSent: boolean };
}

/**
 * "Request access" review queue for the Users page. Renders nothing when
 * there's nothing pending and nothing recently approved.
 */
export function AccessRequestsPanel() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [roles, setRoles] = useState<Record<string, ApproveRole>>({});
  const [rejectTarget, setRejectTarget] = useState<AccessRequest | null>(null);

  const pending = useQuery({ queryKey: accessRequestsKey("pending"), queryFn: () => fetchRequests("pending") });
  const approved = useQuery({ queryKey: accessRequestsKey("approved"), queryFn: () => fetchRequests("approved") });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "access-requests"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const approve = useMutation({
    mutationFn: ({ id, role }: { id: string; role: ApproveRole }) => postAction(id, "approve", { role }),
    onSuccess: (res, { role }) => {
      if (res.emailSent) toast.success(`Approved as ${role} — invite email sent`);
      else toast.warning(`Approved as ${role}, but the invite email failed. Use "Resend invite".`);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reject = useMutation({
    mutationFn: (id: string) => postAction(id, "reject"),
    onSuccess: () => {
      toast.success("Request rejected");
      setRejectTarget(null);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resend = useMutation({
    mutationFn: (id: string) => postAction(id, "resend"),
    onSuccess: (res) => {
      if (res.emailSent) toast.success("New invite email sent");
      else toast.error("Couldn't send the invite email. Check the Resend setup.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pendingRows = pending.data ?? [];
  const approvedRows = approved.data ?? [];
  if (pending.isLoading || (pendingRows.length === 0 && approvedRows.length === 0)) return null;

  const rows = tab === "pending" ? pendingRows : approvedRows;

  return (
    <div className="shrink-0 rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
        <div>
          <p className="text-sm font-semibold">Access requests</p>
          <p className="text-xs text-muted-foreground">
            People who asked to join from the sign-in page.
          </p>
        </div>
        <div role="group" aria-label="Request status" className="inline-flex rounded-lg border bg-background p-0.5">
          {(["pending", "approved"] as const).map((key) => {
            const count = key === "pending" ? pendingRows.length : approvedRows.length;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                  tab === key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {key}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                    key === "pending" && count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">
          {tab === "pending" ? "No requests waiting for review." : "No recently approved requests."}
        </p>
      ) : (
        <ul className="max-h-72 divide-y overflow-y-auto">
          {rows.map((r) => {
            const role = roles[r.id] ?? "viewer";
            const isApproving = approve.isPending && approve.variables?.id === r.id;
            const isResending = resend.isPending && resend.variables === r.id;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <UserAvatar name={r.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.email} ·{" "}
                    {tab === "pending"
                      ? `requested ${formatDate(r.createdAt)}`
                      : `approved as ${r.role ?? "viewer"} ${r.reviewedAt ? formatDate(r.reviewedAt) : ""}`}
                  </p>
                  {r.message && (
                    <p className="mt-1 line-clamp-2 text-xs text-foreground/80" title={r.message}>
                      &ldquo;{r.message}&rdquo;
                    </p>
                  )}
                </div>

                {tab === "pending" ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Select
                      value={role}
                      onValueChange={(v) => setRoles((prev) => ({ ...prev, [r.id]: v as ApproveRole }))}
                    >
                      <SelectTrigger size="sm" className="h-8 w-26 text-xs" aria-label={`Role for ${r.fullName}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="seller">Seller</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate({ id: r.id, role })}
                    >
                      {isApproving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-destructive hover:text-destructive"
                      disabled={approve.isPending}
                      onClick={() => setRejectTarget(r)}
                      aria-label={`Reject ${r.fullName}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    disabled={resend.isPending}
                    onClick={() => resend.mutate(r.id)}
                  >
                    {isResending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    Resend invite
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {tab === "approved" && approvedRows.length > 0 && (
        <p className="flex items-center gap-1.5 border-t px-5 py-2 text-[11px] text-muted-foreground">
          <MailWarning className="size-3.5" />
          Resend sends a fresh set-password link if the first one expired or got lost.
        </p>
      )}

      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject access request?"
        description={`${rejectTarget?.fullName ?? ""} (${rejectTarget?.email ?? ""}) will get an email saying their request wasn't approved.`}
        confirmLabel="Reject"
        destructive
        onConfirm={() => rejectTarget && reject.mutate(rejectTarget.id)}
      />
    </div>
  );
}
