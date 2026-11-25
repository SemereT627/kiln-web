"use client";

import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ExternalLink, ScrollText } from "lucide-react";
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
    <div className={cn("flex flex-col gap-2 rounded-xl p-3 text-xs", toneClass)}>
      {items.map((item, i) => {
        const ceramicId = String(item.ceramicId ?? "");
        const ceramic = ceramicLookup?.get(ceramicId);
        const { ceramicId: _omit, ...rest } = item;
        void _omit;
        return (
          <div key={i} className="min-w-0">
            <p className="font-medium break-words">
              {ceramic ? `${ceramic.name} (${ceramic.productId})` : ceramicId || "—"}
            </p>
            <p className="font-mono break-words opacity-80">
              {Object.entries(rest)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")}
            </p>
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
    <pre className={cn("whitespace-pre-wrap break-all rounded-xl p-3 text-xs", toneClass)}>
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

  const label = (text: string) => (
    <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{text}</p>
  );

  // Side panel rather than a centred modal: long values get the full height
  // and before/after stack instead of squeezing side by side.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="flex-row items-start gap-3 border-b border-dashed p-5 pr-12">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-ink-foreground">
            <ScrollText className="size-4" />
          </span>
          <div className="min-w-0">
            <SheetTitle className="break-words">{title ?? "Change details"}</SheetTitle>
            <SheetDescription>Full before/after diff recorded for this event.</SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-3 p-5">
          {targetId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted px-4 py-3">
              <span className="min-w-0 break-all font-mono text-[11px] text-muted-foreground">
                {targetId}
              </span>
              {isOrder && (
                <Link
                  href={`/sales/log?order=${targetId}`}
                  className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-ink px-3 text-xs font-medium text-ink outline-none transition-colors hover:bg-ink hover:text-ink-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  View in Sales Log
                  <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
          )}

          {rows ? (
            rows.map((row) => (
              <section key={row.key} className="rounded-2xl border border-dashed p-4">
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
                  <div className="mt-3 flex flex-col gap-3">
                    <div>
                      {label("Before")}
                      <ValueDisplay value={row.beforeVal} ceramicLookup={ceramicLookup} tone="before" />
                    </div>
                    <div>
                      {label("After")}
                      <ValueDisplay value={row.afterVal} ceramicLookup={ceramicLookup} tone="after" />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <ValueDisplay
                      value={row.afterVal ?? row.beforeVal}
                      ceramicLookup={ceramicLookup}
                      tone="neutral"
                    />
                  </div>
                )}
              </section>
            ))
          ) : (
            <>
              <div>
                {label("Before")}
                <pre className="whitespace-pre-wrap break-all rounded-xl bg-muted/40 p-3 text-xs">
                  {before != null ? JSON.stringify(before, null, 2) : "—"}
                </pre>
              </div>
              <div>
                {label("After")}
                <pre className="whitespace-pre-wrap break-all rounded-xl bg-muted/40 p-3 text-xs">
                  {after != null ? JSON.stringify(after, null, 2) : "—"}
                </pre>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
