"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, ChevronDown, PieChart } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { DashCard } from "@/components/dashboard/chart-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const UP_BLOCKS = 6;
const DOWN_BLOCKS = 8;

/**
 * Sold vs in-stock per tile size as columns of blocks: sold stacks up from
 * the axis (terracotta), stock hangs below it (navy). Block counts are
 * scaled to the largest size on each side.
 */
export function SellThroughCard({
  sizes,
  isAdmin,
  className,
}: {
  sizes: { name: string; sold: number; stock: number }[];
  isAdmin: boolean;
  className?: string;
}) {
  const t = useTranslations("Dashboard.sellThrough");
  const cols = sizes.slice(0, 8);
  const sold = sizes.reduce((a, s) => a + Math.max(0, s.sold), 0);
  const stock = sizes.reduce((a, s) => a + Math.max(0, s.stock), 0);
  const rate = sold + stock > 0 ? (sold / (sold + stock)) * 100 : 0;
  const maxSold = Math.max(...cols.map((c) => c.sold), 1);
  const maxStock = Math.max(...cols.map((c) => c.stock), 1);
  const blocks = (v: number, max: number, n: number) =>
    v > 0 ? Math.max(1, Math.round((v / max) * n)) : 0;

  return (
    <DashCard
      className={className}
      icon={PieChart}
      title={t("title")}
      subtitle={t("subtitle")}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-ink px-3 text-xs font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            {t("report")}
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/inventory">{t("inventory")}</Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/analytics">{t("analytics")}</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      }
      contentClassName="flex gap-4"
    >
      <div className="flex w-36 shrink-0 flex-col justify-between">
        <div className="pt-8">
          <p className="flex items-center gap-2">
            <span className="text-[40px] font-semibold leading-none tracking-tight tabular-nums">
              {Math.round(rate)}%
            </span>
            <Link
              href="/inventory"
              aria-label={t("inventory")}
              className="flex size-5 items-center justify-center rounded-full border border-foreground/70"
            >
              <ArrowUpRight className="size-3" />
            </Link>
          </p>
          <p className="mt-2 text-sm font-medium">{t("rateLabel")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("allTime")}</p>
        </div>
        <div className="space-y-1 text-xs">
          <p className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-primary" />
            {t("sold")}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-ink" />
            {t("inStock")}
          </p>
        </div>
      </div>

      {cols.length === 0 ? (
        <p className="flex-1 self-center text-center text-sm text-muted-foreground">{t("noData")}</p>
      ) : (
        <div className="flex min-w-0 flex-1 gap-2 self-center">
          <div
            role="img"
            aria-label={cols
              .map((c) => `${c.name}: ${formatNumber(c.sold, 0)} m² ${t("sold")}, ${formatNumber(c.stock, 0)} m² ${t("inStock")}`)
              .join("; ")}
            className="flex min-w-0 flex-1 justify-around gap-1"
          >
            {cols.map((c) => {
              const up = blocks(c.sold, maxSold, UP_BLOCKS);
              const down = blocks(c.stock, maxStock, DOWN_BLOCKS);
              return (
                <div
                  key={c.name}
                  title={`${c.name} · ${formatNumber(c.sold, 0)} m² ${t("sold")} · ${formatNumber(c.stock, 0)} m² ${t("inStock")}`}
                  className="flex w-full max-w-6 flex-col items-center"
                >
                  {/* Sold: grows up from the axis, fading toward the top */}
                  <div className="flex h-[calc(6*0.875rem)] w-full flex-col-reverse gap-[3px]">
                    {Array.from({ length: up }, (_, i) => (
                      <span
                        key={i}
                        className="bg-hatch h-[11px] w-full shrink-0 rounded-[3px] bg-primary text-white/15"
                        style={{ opacity: 1 - (i / UP_BLOCKS) * 0.55 }}
                      />
                    ))}
                  </div>
                  {/* In stock: hangs down from the axis, fading toward the bottom */}
                  <div className="mt-[3px] flex h-[calc(8*0.875rem)] w-full flex-col gap-[3px]">
                    {Array.from({ length: down }, (_, i) => (
                      <span
                        key={i}
                        className="bg-hatch h-[11px] w-full shrink-0 rounded-[3px] bg-ink text-white/15"
                        style={{ opacity: 1 - (i / DOWN_BLOCKS) * 0.65 }}
                      />
                    ))}
                  </div>
                  {/* Full size name, allowed to run wider than its column */}
                  <span className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">
                    {c.name}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Scale: share of the largest size, sold above, stock below */}
          <div
            aria-hidden="true"
            className="flex shrink-0 flex-col justify-between border-l border-dashed pb-4 pl-1.5 text-[9px] leading-none text-muted-foreground tabular-nums"
          >
            {[100, 75, 50, 25, 0, 25, 50, 75, 100].map((v, i) => (
              <span key={i}>{v}</span>
            ))}
          </div>
        </div>
      )}
    </DashCard>
  );
}
