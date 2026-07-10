import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseEthiopianDate } from "@/lib/ethiopian-calendar";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

interface ImportRow {
  date: string;         // DD/MM/YYYY in Ethiopian calendar
  productCode: string;
  ceramicName: string;
  size: string;
  quantity: number;
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
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
      .from("ceramics")
      .select("id, product_code");

    if (ceramicsError) throw ceramicsError;

    const ceramicMap = new Map<string, string>(
      (ceramics || []).map((c: { id: string; product_code: string }) => [
        c.product_code.toUpperCase(),
        c.id,
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
          created_at: gregorianDate.toISOString(),
        },
      ]);

      if (insertError) {
        skipped.push({ row, reason: insertError.message });
      } else {
        inserted.push(i);
      }
    }

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
