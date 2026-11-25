"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Package, Settings, Wallet } from "lucide-react";
import { formatETB } from "@/lib/utils";

const ICON_BUTTON =
  "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * Top of the dashboard's left column, shaped like the reference's workspace
 * switcher: square terracotta chip, a name and a muted line. Admins see the
 * total stock value, only rendered into the DOM once revealed so it can't
 * leak via screen readers or devtools; everyone else sees the catalog size
 * and a settings shortcut.
 */
export function WorkspaceCard({
  productCount,
  isAdmin,
  stockValue,
  valueRevealed,
  onToggleValue,
}: {
  productCount: number;
  isAdmin: boolean;
  stockValue: number;
  valueRevealed: boolean;
  onToggleValue: () => void;
}) {
  const t = useTranslations("Dashboard.workspace");
  const toggleLabel = valueRevealed ? t("hideValue") : t("showValue");
  const Chip = isAdmin ? Wallet : Package;

  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-card px-4 py-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Chip className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">
          {isAdmin ? t("stockValue") : t("catalog")}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {!isAdmin ? (
            t("products", { count: productCount })
          ) : !valueRevealed ? (
            <span className="select-none" aria-label={t("valueHidden")}>
              ••••• ETB
            </span>
          ) : stockValue > 0 ? (
            formatETB(stockValue)
          ) : (
            t("noPriceData")
          )}
        </p>
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={onToggleValue}
          aria-pressed={valueRevealed}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {valueRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      )}
      {!isAdmin && (
        <>
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />
          <Link href="/profile" aria-label={t("settings")} title={t("settings")} className={ICON_BUTTON}>
            <Settings className="size-4" />
          </Link>
        </>
      )}
    </div>
  );
}
