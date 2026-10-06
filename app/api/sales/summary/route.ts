import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Paginated day-level summary, backed by the get_sales_day_summary() RPC —
// see its definition in supabase/schema.sql for why it's there (the Sales
// Log page used to fetch every sale ever recorded just to group it by day
// client-side).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_sales_day_summary", {
      p_date_from: dateFrom ? `${dateFrom}T00:00:00.000+03:00` : null,
      p_date_to: dateTo ? `${dateTo}T23:59:59.999+03:00` : null,
      p_page: page,
      p_limit: limit,
    });

    if (error) throw error;

    const rows = data || [];
    const totalDays = rows[0]?.total_days ?? 0;

    return NextResponse.json({
      data: rows.map((r: any) => ({
        date: r.sale_date,
        transactionCount: Number(r.transaction_count),
        totalSqm: Number(r.total_sqm),
        totalLinear: Number(r.total_linear),
        grossTotal: r.gross_total !== null ? Number(r.gross_total) : null,
      })),
      total: Number(totalDays),
      page,
      limit,
      summary: {
        totalDays: Number(totalDays),
        totalTransactions: Number(rows[0]?.grand_transaction_count ?? 0),
        totalSqm: Number(rows[0]?.grand_total_sqm ?? 0),
        totalLinear: Number(rows[0]?.grand_total_linear ?? 0),
      },
    });
  } catch (error: any) {
    console.error("GET Sales Summary Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
