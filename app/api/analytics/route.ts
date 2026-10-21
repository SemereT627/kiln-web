import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

// Addis Ababa is fixed UTC+3 (no DST) — same convention as /api/sales and
// get_sales_day_summary, so analytics days line up with the Sales Log.
const TZ_OFFSET = "+03:00";
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// PostgREST caps responses at 1000 rows by default, so sales are paged.
const PAGE_SIZE = 1000;

type Unit = "m²" | "m" | "pcs";
type Granularity = "day" | "week" | "month";

interface SaleRow {
  quantity: number;
  price_at_sale: number;
  sold_at: string;
  sold_by: string | null;
  ceramic_id: string;
}

interface InventoryRow {
  id: string;
  product_code: string;
  name: string;
  brand_name: string | null;
  size: string | null;
  measurement_unit: string | null;
  current_stock: number;
}

const isDateString = (s: string | null): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** YYYY-MM-DD of a UTC instant, in Addis Ababa local time. */
function localDay(iso: string | number) {
  return new Date(new Date(iso).getTime() + TZ_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** Bucket key for a local day: itself, its week's Monday, or YYYY-MM. */
function bucketKey(day: string, granularity: Granularity) {
  if (granularity === "day") return day;
  if (granularity === "month") return day.slice(0, 7);
  const d = new Date(`${day}T00:00:00Z`);
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  return addDays(day, -mondayOffset);
}

function bucketKeys(from: string, to: string, granularity: Granularity) {
  const keys: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const key = bucketKey(day, granularity);
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  return keys;
}

async function fetchSales(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string,
) {
  const rows: SaleRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("sales")
      .select("quantity, price_at_sale, sold_at, sold_by, ceramic_id")
      .gte("sold_at", `${from}T00:00:00.000${TZ_OFFSET}`)
      .lte("sold_at", `${to}T23:59:59.999${TZ_OFFSET}`)
      .order("sold_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as SaleRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows.map((r) => ({
    ...r,
    quantity: Number(r.quantity),
    price_at_sale: Number(r.price_at_sale),
  }));
}

function summarize(
  sales: SaleRow[],
  unitOf: (ceramicId: string) => Unit,
) {
  const totals = { revenue: 0, tileSqm: 0, skirtingM: 0, pieces: 0, transactions: sales.length };
  for (const s of sales) {
    totals.revenue += s.quantity * s.price_at_sale;
    const unit = unitOf(s.ceramic_id);
    if (unit === "m²") totals.tileSqm += s.quantity;
    else if (unit === "m") totals.skirtingM += s.quantity;
    else totals.pieces += s.quantity;
  }
  return totals;
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const today = localDay(Date.now());
    const dateTo = isDateString(searchParams.get("dateTo"))
      ? searchParams.get("dateTo")!
      : today;
    const dateFrom = isDateString(searchParams.get("dateFrom"))
      ? searchParams.get("dateFrom")!
      : addDays(dateTo, -29);
    if (dateFrom > dateTo) {
      return NextResponse.json({ error: "dateFrom must be before dateTo" }, { status: 400 });
    }

    const rangeDays = daysBetween(dateFrom, dateTo);
    const prevTo = addDays(dateFrom, -1);
    const prevFrom = addDays(prevTo, -(rangeDays - 1));
    const granularity: Granularity =
      rangeDays <= 45 ? "day" : rangeDays <= 200 ? "week" : "month";

    const supabase = await createClient();

    const [sales, prevSales, inventoryRes] = await Promise.all([
      fetchSales(supabase, dateFrom, dateTo),
      fetchSales(supabase, prevFrom, prevTo),
      supabase
        .from("vw_ceramics_inventory")
        .select("id, product_code, name, brand_name, size, measurement_unit, current_stock"),
    ]);
    if (inventoryRes.error) throw inventoryRes.error;

    const inventory = new Map<string, InventoryRow>();
    for (const row of (inventoryRes.data || []) as InventoryRow[]) {
      inventory.set(row.id, { ...row, current_stock: Number(row.current_stock) });
    }
    const unitOf = (id: string): Unit =>
      (inventory.get(id)?.measurement_unit as Unit) || "m²";

    // ── Sales over time ────────────────────────────────────────────────
    const series = new Map(
      bucketKeys(dateFrom, dateTo, granularity).map((k) => [
        k,
        { revenue: 0, tileSqm: 0, transactions: 0 },
      ]),
    );
    for (const s of sales) {
      const bucket = series.get(bucketKey(localDay(s.sold_at), granularity));
      if (!bucket) continue;
      bucket.revenue += s.quantity * s.price_at_sale;
      bucket.transactions += 1;
      if (unitOf(s.ceramic_id) === "m²") bucket.tileSqm += s.quantity;
    }

    // ── Top sellers: products, brands, sizes ───────────────────────────
    const byProduct = new Map<string, { quantity: number; revenue: number; transactions: number }>();
    const byBrand = new Map<string, { tileSqm: number; revenue: number }>();
    const bySize = new Map<string, { tileSqm: number; revenue: number }>();
    for (const s of sales) {
      const revenue = s.quantity * s.price_at_sale;
      const product = byProduct.get(s.ceramic_id) ?? { quantity: 0, revenue: 0, transactions: 0 };
      product.quantity += s.quantity;
      product.revenue += revenue;
      product.transactions += 1;
      byProduct.set(s.ceramic_id, product);

      const item = inventory.get(s.ceramic_id);
      const isTile = unitOf(s.ceramic_id) === "m²";
      const brandKey = item?.brand_name || "Unknown";
      const brand = byBrand.get(brandKey) ?? { tileSqm: 0, revenue: 0 };
      brand.revenue += revenue;
      if (isTile) brand.tileSqm += s.quantity;
      byBrand.set(brandKey, brand);

      // Sizes only make sense for tiles — skirting/pieces would skew them.
      if (isTile) {
        const sizeKey = item?.size || "Unknown";
        const size = bySize.get(sizeKey) ?? { tileSqm: 0, revenue: 0 };
        size.revenue += revenue;
        size.tileSqm += s.quantity;
        bySize.set(sizeKey, size);
      }
    }

    // ── Seller performance ─────────────────────────────────────────────
    const bySeller = new Map<string, { transactions: number; tileSqm: number; revenue: number }>();
    for (const s of sales) {
      const key = s.sold_by ?? "unassigned";
      const seller = bySeller.get(key) ?? { transactions: 0, tileSqm: 0, revenue: 0 };
      seller.transactions += 1;
      seller.revenue += s.quantity * s.price_at_sale;
      if (unitOf(s.ceramic_id) === "m²") seller.tileSqm += s.quantity;
      bySeller.set(key, seller);
    }
    const sellerIds = [...bySeller.keys()].filter((k) => k !== "unassigned");
    const sellerNames = new Map<string, string>();
    if (sellerIds.length > 0) {
      const { data: profiles, error } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", sellerIds);
      if (error) throw error;
      for (const p of profiles || []) {
        sellerNames.set(p.id, p.full_name || "Unknown user");
      }
    }

    // ── Stock health ───────────────────────────────────────────────────
    // Pace = units sold per day over the selected range; days of cover =
    // current stock at that pace. Products with stock but no sales in the
    // range are slow movers.
    const health = [...inventory.values()]
      .filter((item) => item.current_stock > 0)
      .map((item) => {
        const sold = byProduct.get(item.id)?.quantity ?? 0;
        const dailyPace = sold / rangeDays;
        return {
          id: item.id,
          productId: item.product_code,
          name: item.name,
          brand: item.brand_name || "Unknown",
          unit: unitOf(item.id),
          currentStock: item.current_stock,
          soldInRange: sold,
          dailyPace,
          daysOfCover: dailyPace > 0 ? item.current_stock / dailyPace : null,
          sellThrough: sold / (sold + item.current_stock),
        };
      });

    // Overall sell-through is tiles only — summing m², m and pcs is meaningless.
    const tiles = health.filter((h) => h.unit === "m²");
    const tileStock = tiles.reduce((a, h) => a + h.currentStock, 0);
    const tileSold = tiles.reduce((a, h) => a + h.soldInRange, 0);

    const current = summarize(sales, unitOf);
    const previous = summarize(prevSales, unitOf);

    return NextResponse.json({
      range: { dateFrom, dateTo, days: rangeDays, granularity, prevFrom, prevTo },
      kpis: { current, previous },
      series: [...series.entries()].map(([bucket, v]) => ({ bucket, ...v })),
      topProducts: [...byProduct.entries()]
        .map(([id, v]) => {
          const item = inventory.get(id);
          return {
            id,
            productId: item?.product_code ?? "—",
            name: item?.name ?? "Deleted product",
            brand: item?.brand_name || "Unknown",
            unit: unitOf(id),
            ...v,
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      byBrand: [...byBrand.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue),
      bySize: [...bySize.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.tileSqm - a.tileSqm),
      sellers: [...bySeller.entries()]
        .map(([id, v]) => ({
          id,
          name: id === "unassigned" ? "Unassigned" : sellerNames.get(id) ?? "Unknown user",
          ...v,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      stockHealth: {
        sellThrough: tileSold + tileStock > 0 ? tileSold / (tileSold + tileStock) : 0,
        stockedProducts: health.length,
        slowMoverCount: health.filter((h) => h.soldInRange === 0).length,
        runningOut: health
          .filter((h) => h.daysOfCover !== null)
          .sort((a, b) => a.daysOfCover! - b.daysOfCover!)
          .slice(0, 8),
        slowMovers: health
          .filter((h) => h.soldInRange === 0)
          .sort((a, b) => b.currentStock - a.currentStock)
          .slice(0, 8),
      },
    });
  } catch (error: unknown) {
    console.error("GET Analytics Error:", error);
    const message =
      (error as { message?: string } | null)?.message ?? "Failed to load analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
