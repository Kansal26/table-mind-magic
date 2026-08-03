import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const TAX_RATE = 0.085;

export type SessionScope = {
  sessionId: string;
  tableId: string;
  restaurantId: string;
};

/**
 * Resolves the QR token to the single open dining session for that table,
 * creating one when needed. Possession of the QR token is the only credential
 * a diner has, so every server function scopes its work through here.
 */
export async function requireSessionScope(qrToken: string): Promise<SessionScope | null> {
  const token = qrToken?.trim();
  if (!token || token.length > 200) return null;

  const { data: table, error } = await supabaseAdmin
    .from("tables")
    .select("id, restaurant_id")
    .eq("qr_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!table) return null;

  const { data: existing, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .select("id")
    .eq("table_id", table.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionError) throw sessionError;

  let sessionId = existing?.id ?? null;
  if (!sessionId) {
    const { data: created, error: createError } = await supabaseAdmin
      .from("sessions")
      .insert({ table_id: table.id, status: "open" })
      .select("id")
      .single();
    if (createError) throw createError;
    sessionId = created.id;
  }

  return { sessionId, tableId: table.id, restaurantId: table.restaurant_id };
}

/** Returns the order only when it belongs to the caller's session. */
export async function requireOwnedOrder(sessionId: string, orderId: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, subtotal, tax, total, session_id")
    .eq("id", orderId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadOrderLines(orderId: string) {
  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select(
      "id, qty, customizations, menu_items(id, name, description, price, category, allergens, dietary_tags, available, image_url)",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const item = row.menu_items as unknown as {
      id: string;
      name: string;
      description: string | null;
      price: number | string;
      category: string;
      allergens: string[];
      dietary_tags: string[];
      available: boolean;
      image_url: string | null;
    };
    return {
      id: row.id,
      qty: row.qty,
      customizations: (row.customizations as { notes?: string } | null) ?? null,
      menu_item: { ...item, price: Number(item.price) },
    };
  });
}

export async function recalcTotals(orderId: string) {
  const lines = await loadOrderLines(orderId);
  const subtotal =
    Math.round(lines.reduce((sum, line) => sum + line.menu_item.price * line.qty, 0) * 100) / 100;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const { error } = await supabaseAdmin
    .from("orders")
    .update({ subtotal, tax, total })
    .eq("id", orderId);
  if (error) throw error;
}

export async function findCartOrder(sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, subtotal, tax, total")
    .eq("session_id", sessionId)
    .eq("status", "cart")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureCartOrder(sessionId: string): Promise<string> {
  const existing = await findCartOrder(sessionId);
  if (existing) return existing.id;
  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({ session_id: sessionId, status: "cart" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
