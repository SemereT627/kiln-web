"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Layers, Trophy } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { DashCard } from "@/components/dashboard/chart-card";
import { ProductImage } from "@/components/product-image";

export interface TopProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  sold: number;
}

/** Best-selling tile products by all-time m² sold, rest folded into "Other". */
export function TopProductsCard({
  products,
  totalSold,
  className,
}: {
  /** All tile products, any order. */
  products: TopProduct[];
  totalSold: number;
  className?: string;
}) {
  const t = useTranslations("Dashboard.topProducts");
  const ranked = [...products].filter((p) => p.sold > 0).sort((a, b) => b.sold - a.sold);
  const top = ranked.slice(0, 4);
  const otherSold = ranked.slice(4).reduce((a, p) => a + p.sold, 0);
  const share = (v: number) => (totalSold > 0 ? `${formatNumber((v / totalSold) * 100)}%` : "0.00%");

  return (
    <DashCard
      className={className}
      icon={Trophy}
      title={t("title")}
      contentClassName="no-scrollbar overflow-y-auto"
    >
      {top.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("noData")}</p>
      ) : (
        <table className="w-full table-fixed text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="pb-2 text-left font-normal">{t("product")}</th>
              <th className="w-24 pb-2 text-right font-normal">{t("share")}</th>
              <th className="w-24 pb-2 text-right font-normal">{t("sold")}</th>
            </tr>
          </thead>
          <tbody>
            {top.map((p) => (
              <tr key={p.id} className="border-t border-dashed">
                <td className="py-3">
                  <Link
                    href={`/inventory/${p.id}`}
                    className="flex min-w-0 items-center gap-2.5 rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <ProductImage
                      src={p.imageUrl}
                      alt=""
                      iconSize="sm"
                      sizes="24px"
                      className="h-4 w-6 shrink-0 overflow-hidden rounded-[3px]"
                    />
                    <span className="truncate font-medium">{p.name}</span>
                  </Link>
                </td>
                <td className="py-3 text-right">{share(p.sold)}</td>
                <td className="py-3 text-right">{formatNumber(p.sold, 0)}</td>
              </tr>
            ))}
            {otherSold > 0 && (
              <tr className="border-t border-dashed">
                <td className="py-3">
                  <span className="flex items-center gap-2.5 font-medium">
                    <Layers className="size-4 w-6 shrink-0 text-muted-foreground" />
                    {t("other")}
                  </span>
                </td>
                <td className="py-3 text-right">{share(otherSold)}</td>
                <td className="py-3 text-right">{formatNumber(otherSold, 0)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </DashCard>
  );
}
