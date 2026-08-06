import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getOwnerRestaurantFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { data: restaurant, error } = await supabaseAdmin
      .from("restaurants")
      .select("*")
      .eq("owner_id", data.userId)
      .maybeSingle();
      
    if (error) throw error;
    return restaurant || null;
  });

export const forceCloseSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ status: "closed" })
      .eq("id", data.sessionId);
    if (error) throw error;
    return { success: true };
  });

export async function getKitchenLoad(restaurantId: string) {
  const { data: activeOrders } = await supabaseAdmin
    .from("orders")
    .select("id, kitchen_status, order_items(menu_items(prep_time_min)), sessions!inner(tables!inner(restaurant_id))")
    .in("kitchen_status", ["received", "preparing"])
    .eq("status", "paid")
    .eq("sessions.tables.restaurant_id", restaurantId);

  if (!activeOrders || activeOrders.length === 0) {
    return { score: 0, level: "low" as const, count: 0 };
  }

  let score = 0;
  for (const order of activeOrders) {
    if (!order.order_items) {
      score += 1;
      continue;
    }
    for (const item of order.order_items) {
      const prepTime = (item.menu_items as any)?.prep_time_min || 10;
      score += prepTime;
    }
  }

  const orderCount = activeOrders.length;
  let level: "low" | "medium" | "high" = "low";
  if (orderCount >= 8) level = "high";
  else if (orderCount >= 4) level = "medium";
  
  return { score, level, count: orderCount };
}

export const getKitchenLoadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    return getKitchenLoad(data.restaurantId);
  });

export const fetchLiveOrdersFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select(`
        id, created_at, kitchen_status,
        sessions!inner(tables!inner(label, restaurant_id)),
        order_items(
          id, qty, allergy_override_ack,
          menu_items(name)
        )
      `)
      .eq("status", "paid")
      .eq("sessions.tables.restaurant_id", data.restaurantId)
      // Fetch anything not served, PLUS anything served today
      .or(`kitchen_status.neq.served,and(kitchen_status.eq.served,created_at.gte.${today.toISOString()})`)
      .order("created_at", { ascending: true });

    return orders || [];
  });

export const updateKitchenStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      orderId: z.string().uuid(),
      status: z.enum(["received", "preparing", "ready", "served"])
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ kitchen_status: data.status })
      .eq("id", data.orderId);
      
    if (error) throw error;
    return { ok: true };
  });

export const fetchAnalyticsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    // 1. Recommendations - note: recommendation_logs doesn't have restaurant_id currently, 
    // but it links to session_id which links to table_id which links to restaurant_id
    const { data: recLogs } = await supabaseAdmin
      .from("recommendation_logs")
      .select("source, added_to_cart, sessions!inner(tables!inner(restaurant_id))")
      .eq("sessions.tables.restaurant_id", data.restaurantId);
      
    const recommendations = {
      llm: { shown: 0, added: 0 },
      rule: { shown: 0, added: 0 }
    };
    
    if (recLogs) {
      for (const log of recLogs) {
        const src = log.source === "llm" ? "llm" : "rule";
        recommendations[src].shown++;
        if (log.added_to_cart) recommendations[src].added++;
      }
    }

    // 2. Feedback (Per-dish)
    const { data: feedbackData } = await supabaseAdmin
      .from("feedback")
      .select("rating, order_id, orders!inner(sessions!inner(tables!inner(restaurant_id)))")
      .eq("orders.sessions.tables.restaurant_id", data.restaurantId)
      .not("rating", "is", null);
      
    const itemRatings: Record<string, { name: string, sum: number, count: number }> = {};
    
    if (feedbackData && feedbackData.length > 0) {
      const orderIds = feedbackData.map(f => f.order_id);
      const { data: fbOrderItems } = await supabaseAdmin
        .from("order_items")
        .select("order_id, menu_items(id, name)")
        .in("order_id", orderIds);
        
      if (fbOrderItems) {
        for (const oi of fbOrderItems) {
          const fb = feedbackData.find(f => f.order_id === oi.order_id);
          const menuItem = oi.menu_items as any;
          if (fb && menuItem && menuItem.id) {
            if (!itemRatings[menuItem.id]) {
              itemRatings[menuItem.id] = { name: menuItem.name, sum: 0, count: 0 };
            }
            itemRatings[menuItem.id].sum += fb.rating;
            itemRatings[menuItem.id].count += 1;
          }
        }
      }
    }
    
    const feedbackList = Object.values(itemRatings).map(r => ({
      name: r.name,
      avg: Number((r.sum / r.count).toFixed(1)),
      count: r.count
    })).sort((a, b) => b.count - a.count);

    // 3. Coupons
    const { data: discounts } = await supabaseAdmin
      .from("order_discounts")
      .select("discount_amount, coupons!inner(code, name, restaurant_id)")
      .eq("coupons.restaurant_id", data.restaurantId);
      
    const couponStats: Record<string, { name: string, code: string, redeemed: number, total_discount: number }> = {};
    
    if (discounts) {
      for (const d of discounts) {
        const c = d.coupons as any;
        if (c) {
          if (!couponStats[c.code]) {
            couponStats[c.code] = { name: c.name, code: c.code, redeemed: 0, total_discount: 0 };
          }
          couponStats[c.code].redeemed++;
          couponStats[c.code].total_discount += Number(d.discount_amount) || 0;
        }
      }
    }
    
    const couponList = Object.values(couponStats).sort((a, b) => b.redeemed - a.redeemed);

    return { recommendations, feedbackList, couponList };
  });
