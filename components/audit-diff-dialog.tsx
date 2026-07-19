"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type DiffStatus = "added" | "removed" | "changed" | "unchanged";

export type CeramicLookup = Map<string, { name: string; productId: string }>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCeramicItemArray(
  value: unknown,
): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => isPlainObject(v) && "ceramicId" in v)
  );
}

function formatValue(value: unknown) {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function diffRows(before: unknown, after: unknown) {
  if (!isPlainObject(before) && !isPlainObject(after)) return null;
  const b = isPlainObject(before) ? before : {};
  const a = isPlainObject(after) ? after : {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();

  return keys.map((key) => {
    const inBefore = key in b;
    const inAfter = key in a;
    let status: DiffStatus;
    if (!inBefore && inAfter) status = "added";
    else if (inBefore && !inAfter) status = "removed";
    else if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) status = "changed";
    else status = "unchanged";
    return { key, beforeVal: b[key], afterVal: a[key], status };
  });
}

const STATUS_STYLES: Record<DiffStatus, string> = {
  added: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  removed: "bg-destructive/10 text-destructive",
  changed: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  unchanged: "bg-muted text-muted-foreground",
};

function CeramicItemsValue({
  items,
  ceramicLookup,
  tone,
}: {
  items: Record<string, unknown>[];
  ceramicLookup?: CeramicLookup;
  tone: "before" | "after" | "neutral";
}) {
  const toneClass =
    tone === "before"
      ? "bg-destructive/5 text-destructive/90"
      : tone === "after"
        ? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
        : "bg-muted/40 text-muted-foreground";

  return (
    <div className={cn("flex flex-col gap-1 rounded-md p-2 text-xs", toneClass)}>
      {items.map((item, i) => {
        const ceramicId = String(item.ceramicId ?? "");
        const ceramic = ceramicLookup?.get(ceramicId);
        const { ceramicId: _omit, ...rest } = item;
        void _omit;
        return (
          <div key={i} className="flex items-baseline justify-between gap-2">
            <span className="font-medium">
              {ceramic ? `${ceramic.name} (${ceramic.productId})` : ceramicId || "—"}
            </span>
            <span className="shrink-0 font-mono opacity-80">
              {Object.entries(rest)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ValueDisplay({
  value,
  ceramicLookup,
  tone,
}: {
  value: unknown;
  ceramicLookup?: CeramicLookup;
  tone: "before" | "after" | "neutral";
}) {
  if (isCeramicItemArray(value)) {
    return <CeramicItemsValue items={value} ceramicLookup={ceramicLookup} tone={tone} />;
  }
  const toneClass =
    tone === "before"
      ? "bg-destructive/5 text-destructive/90"
      : tone === "after"
        ? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
        : "bg-muted/40 text-muted-foreground";
  return (
    <pre className={cn("whitespace-pre-wrap break-all rounded-md p-2 text-xs", toneClass)}>
      {formatValue(value)}
    </pre>
  );
}

export function AuditDiffDialog({
  open,
  onOpenChange,
  before,
  after,
  title,
  targetTable,
  targetId,
  ceramicLookup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  before: unknown;
  after: unknown;
  title?: string;
  targetTable?: string;
  targetId?: string | null;
  ceramicLookup?: CeramicLookup;
}) {
  const rows = diffRows(before, after);
  const isOrder = targetTable === "orders";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title ?? "Change details"}</DialogTitle>
          <DialogDescription>
            Full before/after diff recorded for this event.
          </DialogDescription>
        </DialogHeader>

        {targetId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              ID: {targetId}
            </span>
            {isOrder && (
              <Button asChild size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                <Link href={`/sales/log?order=${targetId}`}>
                  View in Sales Log
                  <ExternalLink className="size-3" />
                </Link>
              </Button>
            )}
          </div>
        )}

        {rows ? (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div key={row.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold">{row.key}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      STATUS_STYLES[row.status],
                    )}
                  >
                    {row.status}
                  </span>
                </div>
                {row.status !== "unchanged" ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Before
                      </p>
                      <ValueDisplay
                        value={row.beforeVal}
                        ceramicLookup={ceramicLookup}
                        tone="before"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        After
                      </p>
                      <ValueDisplay
                        value={row.afterVal}
                        ceramicLookup={ceramicLookup}
                        tone="after"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <ValueDisplay
                      value={row.afterVal ?? row.beforeVal}
                      ceramicLookup={ceramicLookup}
                      tone="neutral"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Before
              </p>
              <pre className="whitespace-pre-wrap break-all rounded-md bg-muted/40 p-3 text-xs">
                {before != null ? JSON.stringify(before, null, 2) : "—"}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                After
              </p>
              <pre className="whitespace-pre-wrap break-all rounded-md bg-muted/40 p-3 text-xs">
                {after != null ? JSON.stringify(after, null, 2) : "—"}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
