import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSeller } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type SyncOrderItem = { ceramicId: string; quantity: number };

type SyncOrder = {
  clientId: string;
  items: SyncOrderItem[];
  paymentMethod: "cash" | "bank_transfer" | "credit";
  bankAccount?: string | null;
  notes?: string | null;
};

type SyncResult =
  | { clientId: string; status: "synced"; id: string }
  | { clientId: string; status: "rejected"; reason: string };

/**
 * Batch sync endpoint for the offline-first mobile app's order queue.
 * Mirrors /api/sales/sync: each queued order is inserted independently so
 * one rejection doesn't fail the rest of the batch, and a unique-violation
 * on `client_id` means this order was already synced in a prior attempt.
 */
export async function POST(request: Request) {
  const seller = await requireSeller(request);
  if (!seller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const orders: SyncOrder[] = Array.isArray(body?.orders) ? body.orders : [];

  const supabase = await createServiceClient();
  const results: SyncResult[] = [];

  for (const order of orders) {
    if (!order.clientId || !Array.isArray(order.items) || order.items.length === 0 || !order.paymentMethod) {
      results.push({ clientId: order.clientId ?? "unknown", status: "rejected", reason: "invalid_payload" });
      continue;
    }
    if (order.paymentMethod === "bank_transfer" && !order.bankAccount) {
      results.push({ clientId: order.clientId, status: "rejected", reason: "invalid_payload" });
      continue;
    }

    const ceramicIds = order.items.map((i) => i.ceramicId);
    const { data: ceramics } = await supabase
      .from("vw_ceramics_inventory")
      .select("id, price_per_unit")
      .in("id", ceramicIds);
    const priceMap = new Map<string, number>(
      (ceramics || []).map((c: { id: string; price_per_unit: number | null }) => [c.id, c.price_per_unit ?? 0]),
    );

    // Stale mobile catalog cache can reference a deleted/renamed ceramic —
    // reject the whole order rather than silently inserting it at price 0.
    if (ceramicIds.some((cid) => !priceMap.has(cid))) {
      results.push({ clientId: order.clientId, status: "rejected", reason: "invalid_ceramic" });
      continue;
    }

    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          seller_id: seller.id,
          payment_method: order.paymentMethod,
          bank_account: order.paymentMethod === "bank_transfer" ? order.bankAccount : null,
          payment_status: order.paymentMethod === "credit" ? "unpaid" : "paid",
          notes: order.notes ?? null,
          client_id: order.clientId,
        },
      ])
      .select()
      .single();

    if (orderError) {
      if (orderError.code === "23505") {
        // Already synced in a prior attempt — look up its id so the client
        // still learns it (the insert above never returned a row this time).
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("client_id", order.clientId)
          .single();
        results.push({ clientId: order.clientId, status: "synced", id: existing?.id ?? "" });
        continue;
      }
      console.error("orders/sync insert order failed", order.clientId, orderError);
      results.push({ clientId: order.clientId, status: "rejected", reason: "unknown_error" });
      continue;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      order.items.map((item) => ({
        order_id: newOrder.id,
        ceramic_id: item.ceramicId,
        quantity: item.quantity,
        price_at_sale: priceMap.get(item.ceramicId) ?? 0,
      })),
    );

    if (itemsError) {
      console.error("orders/sync insert order_items failed", order.clientId, itemsError);
      results.push({ clientId: order.clientId, status: "rejected", reason: "unknown_error" });
      continue;
    }

    await logAudit({
      actor: seller,
      action: "order.create",
      targetTable: "orders",
      targetId: newOrder.id,
      after: {
        paymentMethod: order.paymentMethod,
        bankAccount: newOrder.bank_account,
        items: order.items,
      },
    });

    results.push({ clientId: order.clientId, status: "synced", id: newOrder.id });
  }

  return NextResponse.json({ results });
}
