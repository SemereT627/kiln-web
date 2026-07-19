"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DataCardField<T> {
  label: string;
  render: (row: T) => ReactNode;
  /** Field spans both grid columns instead of sharing a row with another field. */
  fullWidth?: boolean;
}

interface DataCardListProps<T> {
  items: T[];
  keyFor: (row: T) => string;
  /** Fields rendered as label/value pairs beneath the header row. */
  fields: DataCardField<T>[];
  /** Image, avatar, or icon shown left of the title. */
  renderLeading?: (row: T) => ReactNode;
  renderTitle: (row: T) => ReactNode;
  renderSubtitle?: (row: T) => ReactNode;
  /** Action menu / status shown top-right of the card; clicks inside it never trigger onRowClick. */
  renderTrailing?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataCardList<T>({
  items,
  keyFor,
  fields,
  renderLeading,
  renderTitle,
  renderSubtitle,
  renderTrailing,
  onRowClick,
  className,
}: DataCardListProps<T>) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {items.map((row) => (
        <div
          key={keyFor(row)}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          className={cn(
            "rounded-xl border bg-card p-4 shadow-xs transition-colors",
            onRowClick && "cursor-pointer active:bg-muted/50 hover:border-primary/30",
          )}
        >
          <div className="flex items-start gap-3">
            {renderLeading && <div className="shrink-0">{renderLeading(row)}</div>}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-sm font-semibold leading-tight">
                  {renderTitle(row)}
                </div>
                {renderTrailing && (
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    {renderTrailing(row)}
                  </div>
                )}
              </div>
              {renderSubtitle && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {renderSubtitle(row)}
                </div>
              )}
            </div>
          </div>

          {fields.length > 0 && (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-3">
              {fields.map((field, i) => (
                <div key={i} className={cn("min-w-0", field.fullWidth && "col-span-2")}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="mt-0.5 truncate text-sm">{field.render(row)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}
