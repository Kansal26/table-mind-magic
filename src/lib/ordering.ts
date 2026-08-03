import { supabase } from "@/integrations/supabase/client";

export const TAX_RATE = 0.085;

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  allergens: string[];
  dietary_tags: string[];
  available: boolean;
  image_url: string | null;
};

export type CartLine = {
  id: string;
  qty: number;
  customizations: { notes?: string } | null;
  menu_item: MenuItem;
};

export type TableContext = {
  tableId: string;
  tableLabel: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string | null;
  sessionId: string;
};

export type Order = {
  id: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
};

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/** Resolves a QR token to its table + restaurant and reuses (or opens) a dining session. */
export async function resolveTable(qrToken: string): Promise<TableContext | null> {
  const { data: table, error } = await supabase
    .from("tables")
    .select("id, label, restaurant_id, restaurants(name, address)")
    .eq("qr_token", qrToken)
    .maybeSingle();
  if (error) throw error;
  if (!table) return null;

  const { data: existing, error: sessionError } = await supabase
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
    const { data: created, error: createError } = await supabase
      .from("sessions")
      .insert({ table_id: table.id, status: "open" })
      .select("id")
      .single();
    if (createError) throw createError;
    sessionId = created.id;
  }

  const restaurant = table.restaurants as unknown as { name: string; address: string | null } | null;
  return {
    tableId: table.id,
    tableLabel: table.label ?? "Your table",
    restaurantId: table.restaurant_id,
    restaurantName: restaurant?.name ?? "Restaurant",
    restaurantAddress: restaurant?.address ?? null,
    sessionId,
  };
}

export async function fetchMenu(restaurantId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, price, category, allergens, dietary_tags, available, image_url")
    .eq("restaurant_id", restaurantId)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((item) => ({ ...item, price: Number(item.price) }));
}

export async function fetchCartOrder(sessionId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, subtotal, tax, total")
    .eq("session_id", sessionId)
    .eq("status", "cart")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    subtotal: Number(data.subtotal),
    tax: Number(data.tax),
    total: Number(data.total),
  };
}

export async function fetchOrder(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, subtotal, tax, total")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    subtotal: Number(data.subtotal),
    tax: Number(data.tax),
    total: Number(data.total),
  };
}

export async function fetchOrderLines(orderId: string): Promise<CartLine[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, qty, customizations, menu_items(id, name, description, price, category, allergens, dietary_tags, available, image_url)",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const item = row.menu_items as unknown as MenuItem;
    return {
      id: row.id,
      qty: row.qty,
      customizations: (row.customizations as { notes?: string } | null) ?? null,
      menu_item: { ...item, price: Number(item.price) },
    };
  });
}

async function recalcTotals(orderId: string) {
  const lines = await fetchOrderLines(orderId);
  const subtotal =
    Math.round(lines.reduce((sum, line) => sum + line.menu_item.price * line.qty, 0) * 100) / 100;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const { error } = await supabase.from("orders").update({ subtotal, tax, total }).eq("id", orderId);
  if (error) throw error;
}

async function ensureCartOrder(sessionId: string): Promise<string> {
  const existing = await fetchCartOrder(sessionId);
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("orders")
    .insert({ session_id: sessionId, status: "cart" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function addToCart(input: {
  sessionId: string;
  menuItemId: string;
  qty: number;
  notes?: string;
}) {
  const orderId = await ensureCartOrder(input.sessionId);
  const { error } = await supabase.from("order_items").insert({
    order_id: orderId,
    menu_item_id: input.menuItemId,
    qty: input.qty,
    customizations: input.notes?.trim() ? { notes: input.notes.trim() } : {},
  });
  if (error) throw error;
  await recalcTotals(orderId);
  return orderId;
}

export async function setLineQty(orderId: string, lineId: string, qty: number) {
  if (qty <= 0) {
    const { error } = await supabase.from("order_items").delete().eq("id", lineId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("order_items").update({ qty }).eq("id", lineId);
    if (error) throw error;
  }
  await recalcTotals(orderId);
}

/** Stub payment: marks the order paid and closes the dining session. */
export async function payOrder(orderId: string, sessionId: string) {
  await recalcTotals(orderId);
  const { error } = await supabase.from("orders").update({ status: "paid" }).eq("id", orderId);
  if (error) throw error;
  const { error: sessionError } = await supabase
    .from("sessions")
    .update({ status: "closed" })
    .eq("id", sessionId);
  if (sessionError) throw sessionError;
}
