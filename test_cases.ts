import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || '';
    if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      value = value.replace(/\\n/gm, '\n');
    }
    env[key] = value.replace(/(^['"]|['"]$)/g, '').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'] || env['SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("Starting Case A-E Tests...\n");

  // 1. Setup Test Users
  const { data: user1Data, error: user1Err } = await supabaseAdmin.auth.admin.createUser({
    email: 'test_nuts@example.com',
    password: 'password123',
    email_confirm: true
  });
  const user1 = user1Data?.user?.id;
  if (!user1) throw new Error("Failed to create user1: " + user1Err?.message);
  
  await supabaseAdmin.from('profiles').upsert({ id: user1, allergens: ['nuts'] });

  const { data: user2Data, error: user2Err } = await supabaseAdmin.auth.admin.createUser({
    email: 'test_no_allergens@example.com',
    password: 'password123',
    email_confirm: true
  });
  const user2 = user2Data?.user?.id;
  if (!user2) throw new Error("Failed to create user2: " + user2Err?.message);

  await supabaseAdmin.from('profiles').upsert({ id: user2, allergens: [] });

  // 2. Fetch a valid session ID
  const { data: session } = await supabaseAdmin.from('sessions').select('id').limit(1).single();
  const sessionId = session?.id;

  // 3. Create Orders
  const { data: order1 } = await supabaseAdmin.from('orders').insert({
    session_id: sessionId, status: 'cart', user_id: user1
  }).select('id').single();
  
  const { data: order2 } = await supabaseAdmin.from('orders').insert({
    session_id: sessionId, status: 'cart', user_id: user2
  }).select('id').single();

  const validOrderId = order1?.id;
  const noAllergenOrderId = order2?.id;

  // 4. Fetch/Create Items
  // Burrata & Heirloom Tomato contains "nuts"
  const { data: nutsItem } = await supabaseAdmin.from('menu_items')
    .select('id').contains('allergens', ['nuts']).limit(1).single();
  const nutsItemId = nutsItem?.id;

  // Ember-Roasted Half Chicken contains "dairy", no nuts
  const { data: dairyItem } = await supabaseAdmin.from('menu_items')
    .select('id').contains('allergens', ['dairy']).limit(1).single();
  const dairyOnlyItemId = dairyItem?.id;

  // Create a null allergen item
  const { data: nullItem } = await supabaseAdmin.from('menu_items').insert({
    restaurant_id: '11111111-1111-4111-8111-111111111111',
    name: 'Null Allergen Dish',
    category: 'Mains',
    price: 10,
    allergens: null,
    available: true
  }).select('id').single();
  const nullAllergensItemId = nullItem?.id;

  console.log("--- CASE A: nuts allergen, nuts item, override = false (MUST FAIL) ---");
  const caseA = await supabaseAdmin.from('order_items').insert({
    order_id: validOrderId, menu_item_id: nutsItemId, qty: 1, allergy_override_ack: false
  });
  console.log("Case A Result:", caseA.error ? caseA.error.message : "SUCCESS (unexpected)");
  console.log();

  console.log("--- CASE B: nuts allergen, nuts item, override = true (MUST SUCCEED) ---");
  const caseB = await supabaseAdmin.from('order_items').insert({
    order_id: validOrderId, menu_item_id: nutsItemId, qty: 1, allergy_override_ack: true
  }).select();
  console.log("Case B Result:", caseB.error ? "FAILED: " + caseB.error.message : "SUCCESS (inserted 1 row)");
  console.log();

  console.log("--- CASE C: nuts allergen, dairy-only item, override = false (MUST SUCCEED) ---");
  const caseC = await supabaseAdmin.from('order_items').insert({
    order_id: validOrderId, menu_item_id: dairyOnlyItemId, qty: 1, allergy_override_ack: false
  }).select();
  console.log("Case C Result:", caseC.error ? "FAILED: " + caseC.error.message : "SUCCESS (inserted 1 row)");
  console.log();

  console.log("--- CASE D: user with no allergens, nuts item, override = false (MUST SUCCEED) ---");
  const caseD = await supabaseAdmin.from('order_items').insert({
    order_id: noAllergenOrderId, menu_item_id: nutsItemId, qty: 1, allergy_override_ack: false
  }).select();
  console.log("Case D Result:", caseD.error ? "FAILED: " + caseD.error.message : "SUCCESS (inserted 1 row)");
  console.log();

  console.log("--- CASE E: nuts allergen user, item with NULL allergens, override = false (MUST SUCCEED) ---");
  const caseE = await supabaseAdmin.from('order_items').insert({
    order_id: validOrderId, menu_item_id: nullAllergensItemId, qty: 1, allergy_override_ack: false
  }).select();
  console.log("Case E Result:", caseE.error ? "FAILED: " + caseE.error.message : "SUCCESS (inserted 1 row)");
  console.log();

  // Cleanup
  await supabaseAdmin.auth.admin.deleteUser(user1);
  await supabaseAdmin.auth.admin.deleteUser(user2);
  await supabaseAdmin.from('menu_items').delete().eq('id', nullAllergensItemId);

  console.log("Cleanup complete.");
}

runTests().catch(console.error);
