"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Box,
  TrendingUp,
  AlertTriangle,
  Eye,
  EyeOff,
  Building2,
  Ruler,
  type LucideIcon,
} from "lucide-react";

const ICON_STYLES: Record<string, string> = {
  neutral: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

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
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.07,
          ease: "power2.out",
        },
      );
    }, containerRef);

    const cleanups = cards.map((card) => {
      const lift = gsap.quickTo(card, "y", {
        duration: 0.3,
        ease: "back.out(2)",
      });
      const shadow = () => {
        card.style.setProperty("--hover-shadow", "1");
      };
      const onEnter = () => {
        lift(-4);
        shadow();
      };
      const onLeave = () => {
        lift(0);
        card.style.setProperty("--hover-shadow", "0");
      };
      card.addEventListener("mouseenter", onEnter);
      card.addEventListener("mouseleave", onLeave);
      return () => {
        card.removeEventListener("mouseenter", onEnter);
        card.removeEventListener("mouseleave", onLeave);
      };
    });

    return () => {
      ctx.revert();
      cleanups.forEach((fn) => fn());
    };
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
}: {
  cardRef: (el: HTMLDivElement | null) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={cardRef}
      className={cn(
        "min-w-0 rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300",
        "hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.12)]",
        className,
      )}
      style={{ willChange: "transform" }}
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
    <div className={cn("rounded-lg p-2 w-fit", ICON_STYLES[variant])}>
      <Icon className="h-4 w-4" strokeWidth={2} />
    </div>
  );
}

export function BentoStatGrid({
  totalProducts,
  tileStock,
  tileSold,
  tileProductCount,
  sparklineData,
  lowStockCount,
  topAlert,
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
  sparklineData: { name: string; stock: number }[];
  lowStockCount: number;
  topAlert: { name: string; stock: number; unit: string } | null;
  brandShare: { name: string; value: number }[];
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
  const cardCount = isAdmin ? 7 : 6;
  const { containerRef, cardRefs } = useCardMotion(cardCount);
  const maxBrand = Math.max(...brandShare.map((b) => b.value), 1);
  const maxSpark = Math.max(...sparklineData.map((s) => s.stock), 1);

  let idx = 0;
  const setRef = (i: number) => (el: HTMLDivElement | null) => {
    cardRefs.current[i] = el;
  };

  return (
    <div
      ref={containerRef}
      className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12"
    >
      {/* Total Products — simple number */}
      <CardShell cardRef={setRef(idx++)} className="lg:col-span-3">
        <IconChip icon={Box} variant="neutral" />
        <p className="text-sm text-muted-foreground mt-4">Total Products</p>
        <div className="text-2xl font-semibold tracking-tight mt-1">
          <CountUp value={totalProducts} />
        </div>
        <p className="text-xs text-muted-foreground/80 mt-1.5">
          Unique items in catalog
        </p>
      </CardShell>

      {/* Tile Stock — number + inline sparkline */}
      <CardShell cardRef={setRef(idx++)} className="lg:col-span-3">
        <div className="flex items-start justify-between">
          <IconChip icon={TrendingUp} variant="emerald" />
          <div className="flex items-end gap-0.5 h-8">
            {sparklineData.map((s, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-emerald-500/30 dark:bg-emerald-400/30"
                style={{
                  height: `${Math.max(12, (s.stock / maxSpark) * 100)}%`,
                }}
                title={`${s.name}: ${s.stock.toFixed(2)}`}
              />
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-4">Tile Stock</p>
        <div className="text-2xl font-semibold tracking-tight mt-1">
          <CountUp value={tileStock} decimals={2} suffix=" m²" />
        </div>
        <p className="text-xs text-muted-foreground/80 mt-1.5">
          {tileSold.toFixed(2)} m² sold · {tileProductCount} products
        </p>
      </CardShell>

      {/* Skirting Stock — simple number */}
      <CardShell cardRef={setRef(idx++)} className="lg:col-span-3">
        <IconChip icon={Ruler} variant="violet" />
        <p className="text-sm text-muted-foreground mt-4">Skirting Stock</p>
        <div className="text-2xl font-semibold tracking-tight mt-1">
          <CountUp value={skirtingStock} decimals={2} suffix=" m" />
        </div>
        <p className="text-xs text-muted-foreground/80 mt-1.5">
          {skirtingSold.toFixed(2)} m sold · {skirtingProductCount} product
          {skirtingProductCount !== 1 ? "s" : ""}
          {otherPcs > 0 ? ` · ${otherPcs.toFixed(0)} pcs` : ""}
        </p>
      </CardShell>

      {/* Low Stock Alerts — badge style */}
      <CardShell cardRef={setRef(idx++)} className="lg:col-span-3">
        <div className="flex items-start justify-between">
          <IconChip icon={AlertTriangle} variant="amber" />
          {lowStockCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Attention
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-4">Low Stock Alerts</p>
        <div className="text-2xl font-semibold tracking-tight mt-1">
          <CountUp value={lowStockCount} />
        </div>
        <p className="text-xs text-muted-foreground/80 mt-1.5 truncate">
          {topAlert
            ? `${topAlert.name} · ${topAlert.stock.toFixed(2)} ${topAlert.unit} left`
            : "All products well-stocked"}
        </p>
      </CardShell>

      {/* Stock by Brand — progress bars, wider card */}
      <CardShell cardRef={setRef(idx++)} className="lg:col-span-6">
        <IconChip icon={Building2} variant="violet" />
        <p className="text-sm text-muted-foreground mt-4 mb-3">
          Stock by Brand
        </p>
        <div className="space-y-2.5">
          {brandShare.map((b) => (
            <div key={b.name} className="flex items-center gap-3">
              <span className="text-xs font-medium w-20 truncate shrink-0">
                {b.name}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500/60 dark:bg-violet-400/60"
                  style={{ width: `${(b.value / maxBrand) * 100}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground w-16 text-right shrink-0">
                {b.value.toFixed(0)} m²
              </span>
            </div>
          ))}
        </div>
      </CardShell>

      {/* Total Sold */}
      <CardShell
        cardRef={setRef(idx++)}
        className={isAdmin ? "lg:col-span-3" : "lg:col-span-6"}
      >
        <IconChip icon={TrendingUp} variant="emerald" />
        <p className="text-sm text-muted-foreground mt-4">Total Sold</p>
        <div className="text-2xl font-semibold tracking-tight mt-1">
          <CountUp value={totalSold} decimals={2} suffix=" m²" />
        </div>
        <p className="text-xs text-muted-foreground/80 mt-1.5">
          + {skirtingSold.toFixed(2)} m skirting sold
        </p>
      </CardShell>

      {/* Total Stock Value — admin only, reveal toggle */}
      {isAdmin && (
        <CardShell cardRef={setRef(idx++)} className="lg:col-span-3">
          <div className="flex items-start justify-between">
            <IconChip icon={Box} variant="neutral" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onToggleStockValue}
            >
              {stockValueRevealed ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Total Stock Value
          </p>
          <div className="relative w-fit">
            <span
              className={cn(
                "text-2xl font-semibold tracking-tight mt-1 block transition-all duration-300",
                !stockValueRevealed && "blur-sm select-none",
              )}
            >
              {stockValue > 0
                ? `${stockValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
                : "No price data"}
            </span>
            {!stockValueRevealed && (
              <span className="absolute inset-0 flex items-center text-xs text-muted-foreground font-medium">
                Click eye to reveal
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/80 mt-1.5">
            Based on products with price set · confidential
          </p>
        </CardShell>
      )}
    </div>
  );
}
