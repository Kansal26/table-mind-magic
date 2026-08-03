import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const qrTokenSchema = z.object({ qrToken: z.string().min(1).max(200) });

const addToCartSchema = z.object({
  qrToken: z.string().min(1).max(200),
  menuItemId: z.string().uuid(),
  qty: z.number().int().min(1).max(50),
  notes: z.string().max(500).optional(),
});

const lineQtySchema = z.object({
  qrToken: z.string().min(1).max(200),
  lineId: z.string().uuid(),
  qty: z.number().int().min(0).max(50),
});

const orderSchema = z.object({
  qrToken: z.string().min(1).max(200),
  orderId: z.string().uuid(),
});

export const resolveTableFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => qrTokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireSessionScope } = await import("./ordering.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const scope = await requireSessionScope(data.qrToken);
    if (!scope) return null;

    const { data: table, error } = await supabaseAdmin
      .from("tables")
      .select("id, label, restaurant_id, restaurants(name, address)")
      .eq("id", scope.tableId)
      .maybeSingle();
    if (error) throw error;
    if (!table) return null;

    const restaurant = table.restaurants as unknown as {
      name: string;
      address: string | null;
    } | null;

    return {
      tableId: table.id,
      tableLabel: table.label ?? "Your table",
      restaurantId: table.restaurant_id,
      restaurantName: restaurant?.name ?? "Restaurant",
      restaurantAddress: restaurant?.address ?? null,
      sessionId: scope.sessionId,
    };
  });

export const fetchCartFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => qrTokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireSessionScope, findCartOrder, loadOrderLines } = await import(
      "./ordering.server"
    );
    const scope = await requireSessionScope(data.qrToken);
    if (!scope) return { order: null, lines: [] };

    const order = await findCartOrder(scope.sessionId);
    if (!order) return { order: null, lines: [] };

    return {
      order: {
        id: order.id,
        status: order.status,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        total: Number(order.total),
      },
      lines: await loadOrderLines(order.id),
    };
  });

export const addToCartFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => addToCartSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireSessionScope, ensureCartOrder, recalcTotals } = await import(
      "./ordering.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const scope = await requireSessionScope(data.qrToken);
    if (!scope) throw new Error("This table code is no longer active.");

    // The item must belong to this table's restaurant and be orderable.
    const { data: item, error: itemError } = await supabaseAdmin
      .from("menu_items")
      .select("id")
      .eq("id", data.menuItemId)
      .eq("restaurant_id", scope.restaurantId)
      .eq("available", true)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new Error("That dish is not available right now.");

    const orderId = await ensureCartOrder(scope.sessionId);
    const notes = data.notes?.trim();
    const { error } = await supabaseAdmin.from("order_items").insert({
      order_id: orderId,
      menu_item_id: item.id,
      qty: data.qty,
      customizations: notes ? { notes } : {},
    });
    if (error) throw error;

    await recalcTotals(orderId);
    return { orderId };
  });

export const setLineQtyFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => lineQtySchema.parse(data))
  .handler(async ({ data }) => {
    const { requireSessionScope, findCartOrder, recalcTotals } = await import(
      "./ordering.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const scope = await requireSessionScope(data.qrToken);
    if (!scope) throw new Error("This table code is no longer active.");

    const order = await findCartOrder(scope.sessionId);
    if (!order) throw new Error("There is no open order for this table.");

    if (data.qty <= 0) {
      const { error } = await supabaseAdmin
        .from("order_items")
        .delete()
        .eq("id", data.lineId)
        .eq("order_id", order.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("order_items")
        .update({ qty: data.qty })
        .eq("id", data.lineId)
        .eq("order_id", order.id);
      if (error) throw error;
    }

    await recalcTotals(order.id);
    return { ok: true };
  });

export const fetchBillFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => orderSchema.parse(data))
  .handler(async ({ data }) => {
    const { resolveTableId, requireOwnedOrder, loadOrderLines } = await import(
      "./ordering.server"
    );

    const tableId = await resolveTableId(data.qrToken);
    if (!tableId) return null;

    const order = await requireOwnedOrder(tableId, data.orderId);
    if (!order) return null;

    return {
      order: {
        id: order.id,
        status: order.status,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        total: Number(order.total),
      },
      lines: await loadOrderLines(order.id),
    };
  });

export const payOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => orderSchema.parse(data))
  .handler(async ({ data }) => {
    const { resolveTableId, requireOwnedOrder, recalcTotals } = await import(
      "./ordering.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tableId = await resolveTableId(data.qrToken);
    if (!tableId) throw new Error("This table code is no longer active.");

    const order = await requireOwnedOrder(tableId, data.orderId);
    if (!order) throw new Error("We couldn't find that bill.");
    if (order.status === "paid") return { ok: true };

    await recalcTotals(order.id);

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "paid" })
      .eq("id", order.id)
      .eq("session_id", order.session_id);
    if (error) throw error;

    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .update({ status: "closed" })
      .eq("id", order.session_id);
    if (sessionError) throw sessionError;

    return { ok: true };
  });
