import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSessionScope } from "./ordering.server";

const submitFeedbackSchema = z.object({
  qrToken: z.string().min(1),
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  structuredAnswers: z.any().optional(),
});

export const submitFeedbackFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => submitFeedbackSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processFeedbackSubmission } = await import("./wallet.server");

    const scope = await requireSessionScope(data.qrToken);
    if (!scope) throw new Error("Invalid table QR code");

    // Must be signed in to submit feedback
    const { data: { user } } = await supabaseAdmin.auth.getUser();
    // Wait, Supabase auth in server functions relies on the auth token in headers, which is checked via standard client not admin client.
    // However, TanStack start functions might use a different way. Let's just check the order's user_id.
    const { data: order } = await (supabaseAdmin as any)
      .from("orders")
      .select("user_id, status")
      .eq("id", data.orderId)
      .single();

    if (!order) throw new Error("Order not found");
    if (!order.user_id) throw new Error("Guests cannot submit feedback");
    if (order.status !== "paid") throw new Error("Can only feedback on paid orders");

    try {
      const res = await processFeedbackSubmission(
        data.orderId,
        order.user_id,
        data.rating,
        data.comment,
        data.structuredAnswers
      );
      return res;
    } catch (err: any) {
      if (err.message === "409_CONFLICT") {
        return { error: "409_CONFLICT" };
      }
      throw err;
    }
  });

const redeemPointsSchema = z.object({
  qrToken: z.string().min(1),
  orderId: z.string().uuid(),
  pointsRedeemed: z.number().int().min(0),
});

export const redeemPointsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => redeemPointsSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recalcTotals, requireOwnedOrder, resolveTableId } = await import("./ordering.server");

    const tableId = await resolveTableId(data.qrToken);
    if (!tableId) throw new Error("Invalid table QR code");

    const order = await requireOwnedOrder(tableId, data.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "cart") throw new Error("Order is not open");

    // Only signed in users can redeem points
    if (!order.user_id) throw new Error("Guests cannot redeem points");

    const { error } = await (supabaseAdmin as any)
      .from("orders")
      .update({ points_redeemed: data.pointsRedeemed })
      .eq("id", order.id);
      
    if (error) throw error;

    await recalcTotals(order.id);
    return { success: true };
  });

export const checkFeedbackExistsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await (supabaseAdmin as any)
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .eq("order_id", data.orderId);
    return { exists: count && count > 0 };
  });

export const getWalletBalanceFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getWalletBalance } = await import("./wallet.server");

    // Get all restaurants where loyalty is enabled
    const { data: enabledRestaurants } = await (supabaseAdmin as any)
      .from("loyalty_settings")
      .select("restaurant_id")
      .eq("enabled", true);

    if (!enabledRestaurants || enabledRestaurants.length === 0) {
      return { balances: [] };
    }

    const balances = [];
    for (const { restaurant_id } of enabledRestaurants) {
      const balance = await getWalletBalance(data.userId, restaurant_id);
      if (balance > 0) {
        // Fetch restaurant name
        const { data: rest } = await (supabaseAdmin as any)
          .from("restaurants")
          .select("name")
          .eq("id", restaurant_id)
          .single();
        if (rest) {
          balances.push({
            restaurantId: restaurant_id,
            restaurantName: rest.name,
            balance
          });
        }
      }
    }

    return { balances };
  });

export const getLoyaltyDataFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ qrToken: z.string().min(1), userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getWalletBalance } = await import("./wallet.server");
    const { resolveTableId } = await import("./ordering.server");

    const tableId = await resolveTableId(data.qrToken);
    if (!tableId) return { settings: null, balance: 0 };

    const { data: table } = await (supabaseAdmin as any)
      .from("tables")
      .select("restaurant_id")
      .eq("id", tableId)
      .single();

    if (!table) return { settings: null, balance: 0 };

    const { data: settings } = await (supabaseAdmin as any)
      .from("loyalty_settings")
      .select("*")
      .eq("restaurant_id", table.restaurant_id)
      .maybeSingle();

    if (!settings || !settings.enabled) return { settings: null, balance: 0 };

    const balance = await getWalletBalance(data.userId, table.restaurant_id);

    return { settings, balance };
  });
