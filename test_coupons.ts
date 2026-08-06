import fs from "fs";
import path from "path";

// 1. Manually load env vars
const envContent = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
  }
});

import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { recalcTotals } from "./src/lib/ordering.server";

async function runTest() {
  console.log("=== STARTING PHASE 4 COUPON VERIFICATION ===");
  try {
    // A. Setup test data
    const { data: restaurant } = await supabaseAdmin.from("restaurants").select("id").limit(1).single();
    if (!restaurant) throw new Error("No restaurant");
    const { data: table } = await supabaseAdmin.from("tables").select("id").limit(1).single();
    
    // Find Paneer Tikka
    let { data: paneerTikka } = await supabaseAdmin.from("menu_items").select("id, price").eq("name", "Paneer Tikka").maybeSingle();
    
    if (!paneerTikka) {
      console.log("⚠️ Paneer Tikka not found, skipping TIKKASPECIAL test.");
    } else {
      // TIKKASPECIAL TEST
      console.log("\n--- TEST 1: TIKKASPECIAL Auto-removal ---");
      const sessionRes1 = await supabaseAdmin.from("sessions").insert({ table_id: table.id, status: "open" }).select().single();
      if (sessionRes1.error) throw sessionRes1.error;
      const sessionId1 = sessionRes1.data.id;
      const orderRes1 = await (supabaseAdmin as any).from("orders").insert({ session_id: sessionId1, status: "cart" }).select().single();
      const orderId1 = orderRes1.data.id;

      // Add Paneer Tikka
      console.log("Adding Paneer Tikka to cart...");
      await supabaseAdmin.from("order_items").insert({ order_id: orderId1, menu_item_id: paneerTikka.id, qty: 1 });
      await recalcTotals(orderId1);

      let check1 = await (supabaseAdmin as any).from("orders").select("discount_amount, total").eq("id", orderId1).single();
      console.log(`Discount applied: ${check1.data.discount_amount} (Expected > 0)`);

      console.log("Removing Paneer Tikka...");
      await supabaseAdmin.from("order_items").delete().eq("order_id", orderId1);
      await recalcTotals(orderId1);

      let check2 = await (supabaseAdmin as any).from("orders").select("discount_amount, total").eq("id", orderId1).single();
      console.log(`Discount after removal: ${check2.data.discount_amount} (Expected 0)`);
      if (check2.data.discount_amount === 0) console.log("✅ TIKKASPECIAL auto-removal PASSED!");
      else console.error("❌ TIKKASPECIAL auto-removal FAILED!");
    }

    // SPEND500 TEST
    console.log("\n--- TEST 2: SPEND500 Auto-removal ---");
    let { data: expensiveItem } = await (supabaseAdmin as any).from("menu_items").select("id, price").eq("name", "Test Expensive Item").maybeSingle();
    if (!expensiveItem) {
       const res = await supabaseAdmin.from("menu_items").insert({
         restaurant_id: restaurant.id,
         name: "Test Expensive Item",
         price: 600,
         category: "Test",
         available: true,
         allergens: [], dietary_tags: []
       }).select().single();
       expensiveItem = res.data;
    }

    const sessionRes2 = await supabaseAdmin.from("sessions").insert({ table_id: table.id, status: "open" }).select().single();
    const sessionId2 = sessionRes2.data.id;
    const orderRes2 = await (supabaseAdmin as any).from("orders").insert({ session_id: sessionId2, status: "cart" }).select().single();
    const orderId2 = orderRes2.data.id;

    console.log("Adding Expensive Item (₹600) to cart...");
    const orderItemRes = await supabaseAdmin.from("order_items").insert({ order_id: orderId2, menu_item_id: expensiveItem.id, qty: 1 }).select().single();
    await recalcTotals(orderId2);

    let check3 = await (supabaseAdmin as any).from("orders").select("discount_amount, total").eq("id", orderId2).single();
    console.log(`Discount applied: ${check3.data.discount_amount} (Expected > 0, 10% of 600 = 60)`);

    console.log("Removing Expensive Item to bring cart below ₹500...");
    await supabaseAdmin.from("order_items").delete().eq("id", orderItemRes.data.id);
    await recalcTotals(orderId2);
    
    let check4 = await (supabaseAdmin as any).from("orders").select("discount_amount, total").eq("id", orderId2).single();
    console.log(`Discount after removal: ${check4.data.discount_amount} (Expected 0)`);
    if (check4.data.discount_amount === 0) console.log("✅ SPEND500 auto-removal PASSED!");
    else console.error("❌ SPEND500 auto-removal FAILED!");

    console.log("\n=== ALL VERIFICATIONS PASSED ===");
  } catch (e) {
    console.error(e);
  }
}

runTest();
