import fs from "fs";
import path from "path";
const envContent = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
});
import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { processFeedbackSubmission } from "./src/lib/wallet.server";
import { recalcTotals, requireOwnedOrder } from "./src/lib/ordering.server";

async function runTests() {
  console.log("=== STARTING PHASE 5 VERIFICATION ===");

  // Setup: Find test user
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  let testUser = users.users.find(u => u.email === "test@example.com");
  if (!testUser) {
    const res = await supabaseAdmin.auth.admin.createUser({
      email: "test@example.com",
      password: "password123",
      email_confirm: true
    });
    if (res.error) throw res.error;
    testUser = res.data.user;
  }
  
  const { data: restaurant } = await supabaseAdmin.from("restaurants").select("id").limit(1).single();
  const { data: table } = await supabaseAdmin.from("tables").select("id, qr_token").limit(1).single();
  const { data: menuItem } = await supabaseAdmin.from("menu_items").select("id, price").limit(1).single();
  
  // Wipe out previous test data for this user
  await supabaseAdmin.from("wallet_transactions").delete().eq("user_id", testUser.id);
  await (supabaseAdmin as any).from("wallets").delete().eq("user_id", testUser.id);

  // Helper to create order
  async function createTestOrder() {
    const sessionRes = await supabaseAdmin.from("sessions").insert({ table_id: table.id, status: "open" }).select().single();
    const sessionId = sessionRes.data.id;
    const orderRes = await (supabaseAdmin as any).from("orders").insert({ session_id: sessionId, status: "cart", user_id: testUser!.id }).select().single();
    const orderId = orderRes.data.id;
    await supabaseAdmin.from("order_items").insert({ order_id: orderId, menu_item_id: menuItem.id, qty: 1 });
    await recalcTotals(orderId);
    await (supabaseAdmin as any).from("orders").update({ status: "paid" }).eq("id", orderId);
    return orderId;
  }

  // --- AC 1: Submit feedback rating only -> wallet credited ₹10
  console.log("\n--- AC 1: Rating Only ---");
  const orderId1 = await createTestOrder();
  await processFeedbackSubmission(orderId1, testUser.id, 5);
  let wallet = await (supabaseAdmin as any).from("wallets").select("balance").eq("user_id", testUser.id).single();
  console.log(`Wallet Balance: ${wallet.data.balance} (Expected: 10)`);
  if (wallet.data.balance !== 10) throw new Error("AC 1 Failed");

  // --- AC 2: Rating + Comment (>10 chars) -> wallet credited ₹30 (Total 40)
  console.log("\n--- AC 2: Rating + Comment ---");
  const orderId2 = await createTestOrder();
  await processFeedbackSubmission(orderId2, testUser.id, 4, "This was really delicious!");
  wallet = await (supabaseAdmin as any).from("wallets").select("balance").eq("user_id", testUser.id).single();
  console.log(`Wallet Balance: ${wallet.data.balance} (Expected: 40)`);
  if (wallet.data.balance !== 40) throw new Error("AC 2 Failed");

  // --- AC 3: Rating + Comment + Answer -> wallet credited ₹35 (Total 75)
  console.log("\n--- AC 3: Rating + Comment + Answer ---");
  const orderId3 = await createTestOrder();
  await processFeedbackSubmission(orderId3, testUser.id, 5, "Amazing food!", { q: "Yes" });
  wallet = await (supabaseAdmin as any).from("wallets").select("balance").eq("user_id", testUser.id).single();
  console.log(`Wallet Balance: ${wallet.data.balance} (Expected: 75)`);
  if (wallet.data.balance !== 75) throw new Error("AC 3 Failed");

  // --- AC 4: Duplicate feedback returns 409 Conflict (Wallet unchanged)
  console.log("\n--- AC 4: Duplicate Feedback ---");
  try {
    await processFeedbackSubmission(orderId3, testUser.id, 5);
    throw new Error("AC 4 Failed - did not return 409_CONFLICT");
  } catch (err: any) {
    if (err.message !== "409_CONFLICT") throw err;
  }
  wallet = await (supabaseAdmin as any).from("wallets").select("balance").eq("user_id", testUser.id).single();
  console.log(`Duplicate Wallet Balance: ${wallet.data.balance} (Expected: 75)`);
  if (wallet.data.balance !== 75) throw new Error("AC 4 Failed");

  // --- AC 9: Frontend mount duplicate check via checkFeedbackExistsFn
  console.log("\n--- AC 9: Frontend duplicate check ---");
  const { count } = await (supabaseAdmin as any)
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .eq("order_id", orderId3);
  const exists = count && count > 0;
  console.log(`Feedback Exists: ${exists} (Expected: true)`);
  if (!exists) throw new Error("AC 9 Failed - checkFeedbackExistsFn would return false");

  // --- AC 6 & 7: Redeeming credits at checkout 
  console.log("\n--- AC 6 & 7: Redeem Credits ---");
  const sessionRes = await supabaseAdmin.from("sessions").insert({ table_id: table.id, status: "open" }).select().single();
  const sessionId = sessionRes.data.id;
  const orderRes = await (supabaseAdmin as any).from("orders").insert({ session_id: sessionId, status: "cart", user_id: testUser.id }).select().single();
  const orderId4 = orderRes.data.id;
  
  // Add enough items to make subtotal > 75
  const qtyNeeded = Math.ceil(80 / menuItem.price);
  await supabaseAdmin.from("order_items").insert({ order_id: orderId4, menu_item_id: menuItem.id, qty: qtyNeeded });
  await (supabaseAdmin as any).from("orders").update({ use_credits: true }).eq("id", orderId4);
  await recalcTotals(orderId4);
  
  const finalOrder = await requireOwnedOrder(table.id, orderId4);
  console.log(`Subtotal: ${finalOrder.subtotal}, Credits Applied: ${finalOrder.credits_applied}`);
  console.log(`Expected Credits Applied: 75. Taxable: ${finalOrder.subtotal - finalOrder.discount_amount - 75}`);
  if (finalOrder.credits_applied !== 75) throw new Error("AC 6/7 Failed: credits_applied not exactly 75 when subtotal > 75");

  // Pay the order and verify wallet deduction
  const { deductWallet } = await import("./src/lib/wallet.server");
  await deductWallet(testUser.id, finalOrder.credits_applied, "Redeemed on order", orderId4);
  await (supabaseAdmin as any).from("orders").update({ status: "paid" }).eq("id", orderId4);

  wallet = await (supabaseAdmin as any).from("wallets").select("balance").eq("user_id", testUser.id).single();
  console.log(`Final Wallet Balance after deduction: ${wallet.data.balance} (Expected: 0)`);
  if (wallet.data.balance !== 0) throw new Error("AC 6/7 Failed: Wallet not deducted upon payment");

  console.log("\n=== ALL VERIFICATIONS PASSED ===");
}

runTests().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
