"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Box,
  TrendingUp,
  AlertTriangle,
  Eye,
  EyeOff,
  Ruler,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

// Same chart tokens as the dashboard charts so brand colours feel native.
const BRAND_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

/** Semantic only — see components/stat-card.tsx for the same convention. */
const ICON_STYLES: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground dark:text-warning",
  info: "bg-info/10 text-info",
};

// Entrance stagger only — static cards deliberately have no hover motion so
// that hover feedback is reserved for cards that actually do something.
function useCardMotion(count: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    if (prefersReducedMotion) {
      gsap.set(cards, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cards,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: "power2.out",
          clearProps: "transform",
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, [count]);

  return { containerRef, cardRefs };
}

function CountUp({
  value,
  decimals = 0,
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      el.textContent = value.toFixed(decimals) + suffix;
      return;
    }
    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: value,
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => {
        if (el) el.textContent = obj.val.toFixed(decimals) + suffix;
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, decimals, suffix]);

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  );
}

function CardShell({
  cardRef,
  className,
  children,
  onClick,
  ariaLabel,
}: {
  cardRef: (el: HTMLDivElement | null) => void;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <div
      ref={cardRef}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? ariaLabel : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        onClick &&
          "group/card cursor-pointer outline-none transition-[box-shadow,border-color,background-color] duration-200 hover:border-primary/30 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.14)] focus-visible:ring-[3px] focus-visible:ring-ring/50 active:shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function IconChip({
  icon: Icon,
  variant,
}: {
  icon: LucideIcon;
  variant: string;
}) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg",
        ICON_STYLES[variant],
      )}
    >
      <Icon className="size-4" strokeWidth={2} />
    </div>
  );
}

/**
 * Shared card anatomy: label on the left with the icon (and an optional
 * trailing badge/action before it) on the right, value and supporting text
 * below.
 * Every card renders through this so spacing and type scale stay identical
 * whether or not a card has a badge or action.
 */
function StatBody({
  icon,
  variant,
  trailing,
  label,
  value,
  description,
}: {
  /** Omit when `trailing` is an action that takes the icon's place. */
  icon?: LucideIcon;
  variant?: string;
  trailing?: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex h-9 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">
          {label}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          {icon && <IconChip icon={icon} variant={variant ?? "neutral"} />}
        </div>
      </div>
      {value !== undefined && (
        <div className="text-2xl font-semibold leading-tight tracking-tight tabular-nums">
          {value}
        </div>
      )}
      {description && (
        <div className="mt-auto pt-2 text-xs leading-relaxed text-muted-foreground">
          {description}
        </div>
      )}
    </>
  );
}

export function BentoStatGrid({
  totalProducts,
  tileStock,
  tileSold,
  tileProductCount,
  lowStockCount,
  topAlert,
  onLowStockClick,
  brandShare,
  stockValue,
  stockValueRevealed,
  onToggleStockValue,
  isAdmin,
  totalSold,
  skirtingStock,
  skirtingSold,
  skirtingProductCount,
  otherPcs,
}: {
  totalProducts: number;
  tileStock: number;
  tileSold: number;
  tileProductCount: number;
  lowStockCount: number;
  topAlert: { name: string; stock: number; unit: string } | null;
  onLowStockClick?: () => void;
  brandShare: { name: string; value: number; isOther?: boolean }[];
  stockValue: number;
  stockValueRevealed: boolean;
  onToggleStockValue: () => void;
  isAdmin: boolean;
  totalSold: number;
  skirtingStock: number;
  skirtingSold: number;
  skirtingProductCount: number;
  otherPcs: number;
}) {
  const t = useTranslations("BentoStatGrid");
  const cardCount = isAdmin ? 7 : 6;
  const { containerRef, cardRefs } = useCardMotion(cardCount);
  // Negative stock (data errors) shouldn't eat into other brands' share.
  const brandTotal = brandShare.reduce((a, b) => a + Math.max(0, b.value), 0);
  const brandRows = brandShare.map((b, i) => {
    const pct = brandTotal > 0 ? (Math.max(0, b.value) / brandTotal) * 100 : 0;
    return {
      ...b,
      label: b.isOther ? t("stockByBrand.other") : b.name,
      color: b.isOther
        ? "color-mix(in oklch, var(--muted-foreground) 45%, transparent)"
        : BRAND_COLORS[i % BRAND_COLORS.length],
      pct,
      pctLabel: pct === 0 ? "0%" : pct < 1 ? "<1%" : `${Math.round(pct)}%`,
    };
  });
  const hasLowStock = lowStockCount > 0;

  let idx = 0;
  const setRef = (i: number) => (el: HTMLDivElement | null) => {
    cardRefs.current[i] = el;
  };

  return (
    <div
      ref={containerRef}
      className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12"
    >
      {/* Total Products */}
      <CardShell cardRef={setRef(idx++)} className="xl:col-span-3">
        <StatBody
          icon={Box}
          variant="neutral"
          label={t("totalProducts.label")}
          value={<CountUp value={totalProducts} />}
          description={t("totalProducts.description")}
        />
      </CardShell>

      {/* Tile Stock */}
      <CardShell cardRef={setRef(idx++)} className="xl:col-span-3">
        <StatBody
          icon={TrendingUp}
          variant="primary"
          label={t("tileStock.label")}
          value={<CountUp value={tileStock} decimals={2} suffix=" m²" />}
          description={t("tileStock.description", {
            sold: tileSold.toFixed(2),
            count: tileProductCount,
          })}
        />
      </CardShell>

      {/* Skirting Stock */}
      <CardShell cardRef={setRef(idx++)} className="xl:col-span-3">
        <StatBody
          icon={Ruler}
          variant="info"
          label={t("skirtingStock.label")}
          value={<CountUp value={skirtingStock} decimals={2} suffix=" m" />}
          description={[
            t("skirtingStock.description", {
              sold: skirtingSold.toFixed(2),
              count: skirtingProductCount,
            }),
            otherPcs > 0 &&
              t("skirtingStock.pieces", { count: otherPcs.toFixed(0) }),
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      </CardShell>

      {/* Low Stock Alerts — opens the low-stock list on click */}
      <CardShell
        cardRef={setRef(idx++)}
        className={cn(
          "xl:col-span-3",
          hasLowStock && "border-warning/40 bg-warning/4",
        )}
        onClick={hasLowStock ? onLowStockClick : undefined}
        ariaLabel={`${t("lowStockAlerts.label")}: ${lowStockCount}. ${t("lowStockAlerts.viewList")}`}
      >
        <StatBody
          icon={AlertTriangle}
          variant="warning"
          label={t("lowStockAlerts.label")}
          value={<CountUp value={lowStockCount} />}
          description={
            topAlert ? (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span
                  className="min-w-0 max-w-full truncate"
                  title={topAlert.name}
                >
                  <span className="font-medium text-foreground">
                    {topAlert.name}
                  </span>
                  {" · "}
                  {t("lowStockAlerts.left", {
                    stock: topAlert.stock.toFixed(2),
                    unit: topAlert.unit,
                  })}
                </span>
                {hasLowStock && (
                  <span className="flex shrink-0 items-center gap-0.5 font-medium text-primary group-hover/card:underline">
                    {t("lowStockAlerts.viewList")}
                    <ChevronRight className="size-3.5" />
                  </span>
                )}
              </div>
            ) : (
              t("lowStockAlerts.allWellStocked")
            )
          }
        />
      </CardShell>

      {/* Stock by Brand — half the desktop row, full row below xl */}
      <CardShell
        cardRef={setRef(idx++)}
        className="md:col-span-2 xl:col-span-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">
              {t("stockByBrand.label")}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("stockByBrand.description")}
            </p>
          </div>
          {brandShare.length > 0 && (
            <div className="shrink-0 text-right">
              <p className="text-xl font-semibold leading-tight tracking-tight tabular-nums">
                {brandTotal.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}{" "}
                m²
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("stockByBrand.totalStock")}
              </p>
            </div>
          )}
        </div>
        {brandShare.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("stockByBrand.noData")}
          </p>
        ) : (
          <>
            {/* One segmented bar showing each brand's share of total tile
                stock — scaled to the total, not the biggest brand. */}
            <div
              role="img"
              aria-label={brandRows
                .map(
                  (b) => `${b.label}: ${b.value.toFixed(0)} m² (${b.pctLabel})`,
                )
                .join(", ")}
              className="mt-4 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
            >
              {brandRows
                .filter((b) => b.pct > 0)
                .map((b) => (
                  <div
                    key={b.name}
                    className="h-full min-w-1 first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${b.pct}%`, background: b.color }}
                    title={`${b.label}: ${b.value.toFixed(0)} m²`}
                  />
                ))}
            </div>
            <ul
              className="mt-4 grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[repeat(var(--brand-cols),minmax(0,1fr))]"
              style={
                { "--brand-cols": brandRows.length } as React.CSSProperties
              }
            >
              {brandRows.map((b) => {
                const isZero = b.pct === 0;
                return (
                  <li
                    key={b.name}
                    className="flex flex-col rounded-xl border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            isZero && "border border-muted-foreground/60",
                          )}
                          style={isZero ? undefined : { background: b.color }}
                        />
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            isZero && "text-muted-foreground",
                          )}
                          title={b.label}
                        >
                          {b.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {b.pctLabel}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-2 mb-3 text-lg font-semibold leading-tight tabular-nums",
                        isZero && "text-muted-foreground",
                      )}
                    >
                      {b.value.toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      m²
                    </p>
                    <div
                      className="mt-auto h-1 overflow-hidden rounded-full bg-muted"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${b.pct}%`, background: b.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardShell>

      {/* Total Sold + Total Stock Value stacked in the half beside Stock by
          Brand; side by side on tablet. */}
      <div
        className={cn(
          "grid min-w-0 gap-4 md:col-span-2 xl:col-span-6 xl:grid-cols-1 xl:auto-rows-fr",
          isAdmin && "md:grid-cols-2",
        )}
      >
        <CardShell cardRef={setRef(idx++)}>
          <StatBody
            icon={TrendingUp}
            variant="success"
            label={t("totalSold.label")}
            value={<CountUp value={totalSold} decimals={2} suffix=" m²" />}
            description={t("totalSold.description", {
              sold: skirtingSold.toFixed(2),
            })}
          />
        </CardShell>

        {/* Total Stock Value — admin only. The real figure is only rendered
          into the DOM once revealed, so it can't leak via screen readers,
          text selection or devtools while hidden. */}
        {isAdmin && (
          <CardShell cardRef={setRef(idx++)}>
            <StatBody
              trailing={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={onToggleStockValue}
                      aria-pressed={stockValueRevealed}
                      aria-label={
                        stockValueRevealed
                          ? t("totalStockValue.hideAria")
                          : t("totalStockValue.showAria")
                      }
                    >
                      {stockValueRevealed ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {stockValueRevealed
                      ? t("totalStockValue.hideAria")
                      : t("totalStockValue.showAria")}
                  </TooltipContent>
                </Tooltip>
              }
              label={t("totalStockValue.label")}
              value={
                <span aria-live="polite">
                  {!stockValueRevealed ? (
                    <span
                      className="select-none text-muted-foreground"
                      aria-label={t("totalStockValue.hiddenAria")}
                    >
                      ••••••• ETB
                    </span>
                  ) : stockValue > 0 ? (
                    `${stockValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
                  ) : (
                    <span className="text-base font-medium text-muted-foreground">
                      {t("totalStockValue.noPriceData")}
                    </span>
                  )}
                </span>
              }
              description={t("totalStockValue.description")}
            />
          </CardShell>
        )}
      </div>
    </div>
  );
}
