import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const supabase = await createServiceClient();
    
    // Read the seed data
    const filePath = path.join(process.cwd(), "seed_data.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "seed_data.json not found" }, { status: 404 });
    }
    
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const rawData = JSON.parse(fileContent);

    // Filter valid data: must have a product code and some identifiers
    const filteredData = rawData.filter((item: any) => 
      item["Product ID (CODE)"] !== null && 
      item["Ceramic Name"] !== null &&
      item["Size"] !== null
    );

    // 1. Clear existing data in reverse order of dependencies
    await supabase.from("sales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("stock_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("ceramics").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("ceramic_types").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("brands").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("finishes").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2. Seed finishes
    const finishes = [
      { name: "Normal" },
      { name: "Polished" },
      { name: "Decorative" }
    ];
    
    const { data: finishData, error: finishError } = await supabase
      .from("finishes")
      .upsert(finishes, { onConflict: "name" })
      .select();
    
    if (finishError) throw finishError;
    const finishMap = new Map(finishData.map(f => [f.name, f.id]));

    // 3. Process brands
    const brandNames = Array.from(new Set(filteredData.map((item: any) => item["Ceramic Name"])));
    const { data: brandData, error: brandError } = await supabase
      .from("brands")
      .upsert(brandNames.map(name => ({ name })), { onConflict: "name" })
      .select();
    
    if (brandError) throw brandError;
    const brandMap = new Map(brandData.map(b => [b.name, b.id]));

    // 4. Process ceramic types (brand_id + size + finish_id)
    const typesToInsert: any[] = [];
    const typeKeySet = new Set();

    filteredData.forEach((item: any) => {
      const brandName = item["Ceramic Name"];
      const sizeStr = item["Size"] || "Unknown";
      let finish = "Normal";
      let size = sizeStr;

      if (sizeStr.endsWith(" P")) {
        finish = "Polished";
        size = sizeStr.slice(0, -2);
      } else if (sizeStr.endsWith(" N")) {
        finish = "Normal";
        size = sizeStr.slice(0, -2);
      } else if (sizeStr.endsWith(" D")) {
        finish = "Decorative";
        size = sizeStr.slice(0, -2);
      } else if (sizeStr === "ZEKOLO") {
        size = "ZEKOLO";
        finish = "Normal";
      }

      const brandId = brandMap.get(brandName);
      const finishId = finishMap.get(finish);
      const key = `${brandId}-${size}-${finishId}`;
      if (!typeKeySet.has(key)) {
        typeKeySet.add(key);
        typesToInsert.push({ brand_id: brandId, size, finish_id: finishId });
      }
    });

    const { data: typeData, error: typeError } = await supabase
      .from("ceramic_types")
      .upsert(typesToInsert, { onConflict: "brand_id,size,finish_id" })
      .select();
    
    if (typeError) throw typeError;
    const typeMap = new Map(typeData.map(t => [`${t.brand_id}-${t.size}-${t.finish_id}`, t.id]));

    // 5. Insert ceramics and related entries
    let count = 0;
    for (const item of filteredData) {
      const productCode = String(item["Product ID (CODE)"]);
      const brandName = item["Ceramic Name"];
      const sizeStr = item["Size"];
      
      let finish = "Normal";
      let size = sizeStr;
      if (sizeStr.endsWith(" P")) { finish = "Polished"; size = sizeStr.slice(0, -2); }
      else if (sizeStr.endsWith(" N")) { finish = "Normal"; size = sizeStr.slice(0, -2); }
      else if (sizeStr.endsWith(" D")) { finish = "Decorative"; size = sizeStr.slice(0, -2); }
      else if (sizeStr === "ZEKOLO") { size = "ZEKOLO"; finish = "Normal"; }

      const brandId = brandMap.get(brandName);
      const finishId = finishMap.get(finish);
      const typeId = typeMap.get(`${brandId}-${size}-${finishId}`);

      const { data: ceramic, error: ceramicError } = await supabase
        .from("ceramics")
        .upsert([{
          product_code: productCode,
          name: `${brandName} ${sizeStr}`,
          type_id: typeId
        }], { onConflict: "product_code" })
        .select()
        .single();

      if (ceramicError) {
        console.error(`Error inserting ceramic ${productCode}:`, ceramicError.message);
        continue;
      }

      // 6. Starting stock as the first Restock entry
      const initialStock = Number(item["Initial (m2)"] || 0);
      if (initialStock > 0) {
        await supabase.from("stock_entries").insert([{
          ceramic_id: ceramic.id,
          quantity: initialStock,
          entry_type: "Restock"
        }]);
      }

      // 7. Sales Entries — seed data has no historical price, snapshot as 0
      const soldStock = Number(item["Sold"] || 0);
      if (soldStock > 0) {
        await supabase.from("sales").insert([{
          ceramic_id: ceramic.id,
          quantity: soldStock,
          price_at_sale: 0
        }]);
      }
      
      count++;
    }

    return NextResponse.json({ 
      message: "Seeded successfully", 
      count,
      total_items: filteredData.length 
    });
  } catch (error: any) {
    console.error("Seed Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
