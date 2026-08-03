import { supabase } from "@/integrations/supabase/client";
import {
  addToCartFn,
  fetchBillFn,
  fetchCartFn,
  payOrderFn,
  resolveTableFn,
  setLineQtyFn,
} from "@/lib/ordering.functions";

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
  return (await resolveTableFn({ data: { qrToken } })) as TableContext | null;
}

/** Menu + restaurant data is public catalogue content, read straight from the client. */
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

export async function fetchCart(
  qrToken: string,
): Promise<{ order: Order | null; lines: CartLine[] }> {
  return (await fetchCartFn({ data: { qrToken } })) as { order: Order | null; lines: CartLine[] };
}

export async function fetchBill(
  qrToken: string,
  orderId: string,
): Promise<{ order: Order; lines: CartLine[] } | null> {
  return (await fetchBillFn({ data: { qrToken, orderId } })) as {
    order: Order;
    lines: CartLine[];
  } | null;
}

export async function addToCart(input: {
  qrToken: string;
  menuItemId: string;
  qty: number;
  notes?: string;
}) {
  const result = await addToCartFn({ data: input });
  return result.orderId;
}

export async function setLineQty(qrToken: string, lineId: string, qty: number) {
  await setLineQtyFn({ data: { qrToken, lineId, qty } });
}

/** Stub payment: marks the order paid and closes the dining session. */
export async function payOrder(qrToken: string, orderId: string) {
  await payOrderFn({ data: { qrToken, orderId } });
}
