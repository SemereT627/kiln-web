import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth";

type SyncItem = {
  clientId: string;
  ceramicId: string;
  quantity: number;
  priceAtSale?: number | null;
  soldAt: string;
};

type SyncResult =
  | { clientId: string; status: "synced" }
  | { clientId: string; status: "rejected"; reason: string };

/**
 * Batch sync endpoint for the offline-first mobile app. Each queued sale is
 * inserted independently so one rejection doesn't fail the rest of the batch.
 * `clientId` is the mobile app's idempotency key (`sales.client_id`, UNIQUE):
 * a unique-violation means this item was already synced in a prior attempt
 * (e.g. the response was lost after the server committed) and is reported
 * back as synced rather than an error. The existing `trg_check_sale_stock`
 * trigger enforces the oversell rule at insert time — a rejection there is
 * reported as `insufficient_stock` so the app can surface "Sync Failed".
 */
export async function POST(request: Request) {
  const seller = await requireSeller(request);
  if (!seller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const items: SyncItem[] = Array.isArray(body?.sales) ? body.sales : [];

  const supabase = await createServiceClient();
  const results: SyncResult[] = [];

  for (const item of items) {
    if (!item.clientId || !item.ceramicId || !item.quantity || !item.soldAt) {
      results.push({
        clientId: item.clientId ?? "unknown",
        status: "rejected",
        reason: "invalid_payload",
      });
      continue;
    }

    let priceAtSale = item.priceAtSale ?? null;
    if (priceAtSale === null) {
      const { data: ceramic } = await supabase
        .from("vw_ceramics_inventory")
        .select("price_per_unit")
        .eq("id", item.ceramicId)
        .single();
      // Stale mobile catalog cache can reference a deleted/renamed ceramic —
      // reject rather than silently inserting the sale at price 0.
      if (!ceramic) {
        results.push({ clientId: item.clientId, status: "rejected", reason: "invalid_ceramic" });
        continue;
      }
      priceAtSale = ceramic.price_per_unit ?? 0;
    }

    const { error } = await supabase.from("sales").insert([
      {
        ceramic_id: item.ceramicId,
        quantity: item.quantity,
        price_at_sale: priceAtSale,
        sold_by: seller.id,
        sold_at: item.soldAt,
        client_id: item.clientId,
      },
    ]);

    if (!error) {
      results.push({ clientId: item.clientId, status: "synced" });
      continue;
    }

    // Unique violation on client_id — already synced in a prior attempt.
    if (error.code === "23505") {
      results.push({ clientId: item.clientId, status: "synced" });
      continue;
    }

    const isOversell = error.message?.includes("exceeds current stock");
    results.push({
      clientId: item.clientId,
      status: "rejected",
      reason: isOversell ? "insufficient_stock" : "unknown_error",
    });
  }

  return NextResponse.json({ results });
}
