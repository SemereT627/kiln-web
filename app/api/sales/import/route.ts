import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseEthiopianDate } from "@/lib/ethiopian-calendar";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";

interface ImportRow {
  date: string;         // DD/MM/YYYY in Ethiopian calendar
  productCode: string;
  ceramicName: string;
  size: string;
  quantity: number;
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const rows: ImportRow[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Fetch all ceramics once keyed by product_code (upper-cased for case-insensitive match)
    const { data: ceramics, error: ceramicsError } = await supabase
      .from("vw_ceramics_inventory")
      .select("id, product_code, price_per_unit");

    if (ceramicsError) throw ceramicsError;

    const ceramicMap = new Map<string, string>(
      (ceramics || []).map((c: { id: string; product_code: string }) => [
        c.product_code.toUpperCase(),
        c.id,
      ])
    );
    const priceMap = new Map<string, number>(
      (ceramics || []).map((c: { id: string; price_per_unit: number | null }) => [
        c.id,
        c.price_per_unit ?? 0,
      ])
    );

    const inserted: number[] = [];
    const skipped: { row: ImportRow; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Validate quantity
      const qty = Number(row.quantity);
      if (!isFinite(qty) || qty <= 0) {
        skipped.push({ row, reason: "Invalid quantity" });
        continue;
      }

      // Look up ceramic
      const ceramicId = ceramicMap.get(row.productCode?.toString().toUpperCase());
      if (!ceramicId) {
        skipped.push({ row, reason: `Product code "${row.productCode}" not found` });
        continue;
      }

      // Convert Ethiopian date → Gregorian
      let gregorianDate: Date;
      try {
        gregorianDate = parseEthiopianDate(row.date);
      } catch (e: any) {
        skipped.push({ row, reason: e.message });
        continue;
      }

      const { error: insertError } = await supabase.from("sales").insert([
        {
          ceramic_id: ceramicId,
          quantity: qty,
          price_at_sale: priceMap.get(ceramicId) ?? 0,
          sold_at: gregorianDate.toISOString(),
          // Not the true original seller — this is historical data with no
          // recorded rep — but attributing to the importing admin beats a
          // permanently unattributed row.
          sold_by: admin.id,
        },
      ]);

      if (insertError) {
        skipped.push({ row, reason: insertError.message });
      } else {
        inserted.push(i);
      }
    }

    await logAudit({
      actor: admin,
      action: "sales.import",
      targetTable: "sales",
      after: { inserted: inserted.length, skipped: skipped.length },
    });

    return NextResponse.json({
      inserted: inserted.length,
      skipped: skipped.length,
      skippedDetails: skipped,
    });
  } catch (error: any) {
    console.error("Sales Import Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
