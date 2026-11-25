import Link from "next/link";
import { Clock, MoreVertical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Dashboard panel: navy icon chip, title with an optional "scope • time"
 * subtitle, and an action slot on the right.
 */
export function DashCard({
  icon: Icon,
  title,
  subtitle,
  updatedAt,
  action,
  className,
  contentClassName,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** Scope text shown under the title, e.g. "All time". */
  subtitle?: string;
  /** Last refresh time (ms), shown after the subtitle with a clock. */
  updatedAt?: number;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-[20px] bg-card p-5 text-card-foreground",
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-ink-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium leading-tight">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {subtitle}
              {updatedAt ? (
                <>
                  <span aria-hidden="true">•</span>
                  <Clock className="size-3" aria-hidden="true" />
                  {new Date(updatedAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              ) : null}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className={cn("mt-4 min-h-0 flex-1", contentClassName)}>{children}</div>
    </section>
  );
}

/** Outlined navy pill, the reference's "Details" button. */
export function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-7 shrink-0 items-center rounded-full border border-ink px-3 text-xs font-medium text-ink outline-none transition-colors hover:bg-ink hover:text-ink-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  );
}

/** Round grey "⋮" button opening a short list of links. */
export function MoreMenu({
  label,
  items,
}: {
  label: string;
  items: { label: string; href: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((m) => (
          <DropdownMenuItem key={m.href} asChild>
            <Link href={m.href}>{m.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Coloured vertical tick + label, used above bars and in chart footers. */
export function TickLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
      <span aria-hidden="true" className="h-4 w-0.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{children}</span>
    </p>
  );
}

/** Share bar on a hatched track; the filled part ends in a thin card-coloured gap. */
export function HatchedBar({
  pct,
  color,
  className,
}: {
  pct: number;
  color: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-hatch h-4 overflow-hidden rounded-[4px] text-foreground/10", className)}
    >
      <div
        className="h-full rounded-[4px] border-r-[3px] border-card"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  );
}

/** "+2.7%" / "-0.4%" change badge (green up, red down). */
export function ChangeBadge({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  return (
    <span
      className={cn(
        "rounded px-1 py-px text-[10px] font-semibold tabular-nums text-white",
        up ? "bg-success" : "bg-destructive",
      )}
    >
      {up ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

/** Percent change from `prev` to `cur`; null when there is no base to compare. */
export function pctChange(cur: number, prev: number) {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}
