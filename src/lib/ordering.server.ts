import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evaluateCoupons } from "@/lib/coupons.server";

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
  const token = normalizeQrToken(qrToken);
  if (!token) return null;

  const { data: table, error } = await supabaseAdmin
    .from("tables")
    .select("id, restaurant_id")
    .ilike("qr_token", token)
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

/**
 * QR tokens arrive from a URL segment, so they can be percent-encoded, padded
 * with whitespace, or differ in case from the seeded row. Normalize before
 * matching so a valid sticker never reads as "inactive".
 */
export function normalizeQrToken(qrToken: string): string | null {
  if (typeof qrToken !== "string") return null;
  let token = qrToken.trim();
  try {
    token = decodeURIComponent(token).trim();
  } catch {
    // Malformed escape sequence: keep the raw trimmed value.
  }
  if (!token || token.length > 200) return null;
  return token;
}

/** Resolves a QR token to its table without opening a session. */
export async function resolveTableId(qrToken: string): Promise<string | null> {
  const token = normalizeQrToken(qrToken);
  if (!token) return null;
  const { data, error } = await supabaseAdmin
    .from("tables")
    .select("id")
    .ilike("qr_token", token)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Returns the order only when it belongs to a session at the caller's table. */
export async function requireOwnedOrder(tableId: string, orderId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("orders")
    .select("id, status, subtotal, tax, discount_amount, credits_applied, use_credits, total, session_id, user_id, sessions!inner(table_id)")
    .eq("id", orderId)
    .eq("sessions.table_id", tableId)
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

  // DISCOUNT LOGIC
  let appliedDiscount = 0;

  const { data: currentDiscount } = await (supabaseAdmin as any)
    .from("order_discounts")
    .select("id, coupon_id")
    .eq("order_id", orderId)
    .single();

  const eligibleCoupons = await evaluateCoupons(orderId, lines, subtotal);

  if (currentDiscount) {
    if (currentDiscount.coupon_id === null) {
      // User explicitly selected "No offer applied"
      appliedDiscount = 0;
    } else {
      const stillEligible = eligibleCoupons.find(c => c.id === currentDiscount.coupon_id);
      if (stillEligible) {
        appliedDiscount = stillEligible.calculated_discount;
        await (supabaseAdmin as any).from("order_discounts").update({ discount_amount: appliedDiscount }).eq("id", currentDiscount.id);
      } else {
        await (supabaseAdmin as any).from("order_discounts").delete().eq("id", currentDiscount.id);
      }
    }
  } else if (eligibleCoupons.length > 0) {
    // Sort descending by discount amount and pick the highest
    const best = eligibleCoupons.sort((a, b) => b.calculated_discount - a.calculated_discount)[0];
    if (best) {
      appliedDiscount = best.calculated_discount;
      await (supabaseAdmin as any).from("order_discounts").insert({
        order_id: orderId,
        coupon_id: best.id,
        discount_amount: appliedDiscount
      });
    }
  }

  const { data: order } = await (supabaseAdmin as any)
    .from("orders")
    .select("user_id, use_credits")
    .eq("id", orderId)
    .single();

  let creditsApplied = 0;
  if (order?.use_credits && order?.user_id) {
    const { getWalletBalance } = await import("./wallet.server");
    const balance = await getWalletBalance(order.user_id);
    const maxCredits = Math.max(0, subtotal - appliedDiscount);
    creditsApplied = Math.min(balance, maxCredits);
  }

  const taxableAmount = Math.max(0, subtotal - appliedDiscount - creditsApplied);
  const tax = Math.round(taxableAmount * TAX_RATE * 100) / 100;
  const total = Math.max(0, Math.round((taxableAmount + tax) * 100) / 100);
  
  const { error } = await (supabaseAdmin as any)
    .from("orders")
    .update({ subtotal, tax, discount_amount: appliedDiscount, credits_applied: creditsApplied, total })
    .eq("id", orderId);
  if (error) throw error;
}

export async function findCartOrder(sessionId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("orders")
    .select("id, status, subtotal, tax, discount_amount, credits_applied, use_credits, total, user_id")
    .eq("session_id", sessionId)
    .eq("status", "cart")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureCartOrder(sessionId: string, userId?: string | null): Promise<string> {
  const existing = await findCartOrder(sessionId);
  if (existing) {
    if (userId && !existing.user_id) {
      await supabaseAdmin.from("orders").update({ user_id: userId }).eq("id", existing.id);
    }
    return existing.id;
  }
  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({ session_id: sessionId, status: "cart", user_id: userId ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
