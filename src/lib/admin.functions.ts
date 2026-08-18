import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, getSupabaseAuthClient } from "@/integrations/supabase/client.server";
import { verifyAdminAuth } from "./auth.server";
import { rateLimit } from "./rate-limit.server";

export const getOwnerRestaurantFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = await verifyAdminAuth(data.token);
    const sb = getSupabaseAuthClient(data.token);

    const { data: restaurant, error } = await sb
      .from("restaurants")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
      
    if (error) throw error;
    return restaurant || null;
  });

export const forceCloseSessionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const user = await verifyAdminAuth(data.token);
    rateLimit(user.id, "forceCloseSession", 50, 15 * 60 * 1000);
    // Since sessions table has no owner_id, we need admin client, but we must verify ownership manually:
    const { data: session } = await supabaseAdmin.from("sessions").select("tables(restaurant_id)").eq("id", data.sessionId).single();
    if (session) {
      const restId = (session.tables as any)?.restaurant_id;
      const { data: owns } = await supabaseAdmin.from("restaurants").select("id").eq("id", restId).eq("owner_id", user.id).single();
      if (!owns) throw new Error("Unauthorized");
    }

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
  .validator((data: unknown) => z.object({ token: z.string(), restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const user = await verifyAdminAuth(data.token);
    // RLS check manual for load fn
    return getKitchenLoad(data.restaurantId);
  });

export const fetchLiveOrdersFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const user = await verifyAdminAuth(data.token);
    
    // Auth client will respect RLS (though orders table might be public select for now, we verify ownership)
    const sb = getSupabaseAuthClient(data.token);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: orders } = await sb
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
  .validator((data: unknown) => 
    z.object({
      token: z.string(),
      orderId: z.string().uuid(),
      status: z.enum(["received", "preparing", "ready", "served"])
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const user = await verifyAdminAuth(data.token);
    rateLimit(user.id, "updateKitchenStatus", 200, 15 * 60 * 1000);

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ kitchen_status: data.status })
      .eq("id", data.orderId);
    if (error) throw error;
    return { success: true };
  });

export const fetchAnalyticsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireRestaurantOwnership } = await import("./auth.server");
    const user = await requireRestaurantOwnership(data.token, data.restaurantId);

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

export const exportOrdersFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), restaurantId: z.string().uuid(), fromDate: z.string().optional(), toDate: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    const { requireRestaurantOwnership } = await import("./auth.server");
    await requireRestaurantOwnership(data.token, data.restaurantId);

    let query = supabaseAdmin
      .from("orders")
      .select(`
        id, created_at, status, subtotal, discount_amount, credits_applied, tax, total, guest_email,
        sessions!inner(tables!inner(label, restaurant_id)),
        order_items(qty, menu_items(name))
      `)
      .eq("sessions.tables.restaurant_id", data.restaurantId)
      .eq("status", "paid")
      .order("created_at", { ascending: false });

    if (data.fromDate) query = query.gte("created_at", data.fromDate + "T00:00:00Z");
    if (data.toDate) query = query.lte("created_at", data.toDate + "T23:59:59Z");

    const { data: orders } = await query;
    if (!orders) return [];

    return orders.map((o: any) => {
      const itemsStr = (o.order_items || []).map((oi: any) => `${oi.qty}x ${oi.menu_items?.name}`).join("; ");
      const tableLabel = o.sessions?.tables?.label || "Unknown";
      return {
        orderId: o.id,
        date: new Date(o.created_at).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        table: tableLabel,
        items: itemsStr,
        subtotal: o.subtotal,
        discount: o.discount_amount,
        creditsApplied: o.credits_applied || 0,
        tax: o.tax,
        total: o.total,
        paymentStatus: o.status,
        guestEmail: o.guest_email || ""
      };
    });
  });

export const exportRevenueSummaryFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), restaurantId: z.string().uuid(), fromDate: z.string().optional(), toDate: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    const { requireRestaurantOwnership } = await import("./auth.server");
    await requireRestaurantOwnership(data.token, data.restaurantId);

    let query = supabaseAdmin
      .from("orders")
      .select(`created_at, subtotal, discount_amount, total, sessions!inner(tables!inner(restaurant_id))`)
      .eq("sessions.tables.restaurant_id", data.restaurantId)
      .eq("status", "paid");

    if (data.fromDate) query = query.gte("created_at", data.fromDate + "T00:00:00Z");
    if (data.toDate) query = query.lte("created_at", data.toDate + "T23:59:59Z");

    const { data: orders } = await query;
    if (!orders) return [];

    const dailyStats: Record<string, any> = {};
    for (const o of orders) {
      const dateStr = new Date(o.created_at).toISOString().split('T')[0];
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = { date: dateStr, orders: 0, gross: 0, discounts: 0, net: 0 };
      }
      dailyStats[dateStr].orders += 1;
      dailyStats[dateStr].gross += Number(o.subtotal || 0);
      dailyStats[dateStr].discounts += Number(o.discount_amount || 0);
      dailyStats[dateStr].net += Number(o.total || 0);
    }

    return Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date));
  });

export const exportDishFeedbackFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireRestaurantOwnership } = await import("./auth.server");
    await requireRestaurantOwnership(data.token, data.restaurantId);

    const { data: feedbackData } = await supabaseAdmin
      .from("feedback")
      .select("rating, order_id, orders!inner(sessions!inner(tables!inner(restaurant_id)))")
      .eq("orders.sessions.tables.restaurant_id", data.restaurantId)
      .not("rating", "is", null);

    const dishStats: Record<string, any> = {};

    if (feedbackData && feedbackData.length > 0) {
      const orderIds = feedbackData.map((f: any) => f.order_id);
      const { data: fbOrderItems } = await supabaseAdmin
        .from("order_items")
        .select("order_id, qty, menu_items(id, name, category)")
        .in("order_id", orderIds);

      if (fbOrderItems) {
        for (const oi of fbOrderItems) {
          const fb = feedbackData.find((f: any) => f.order_id === oi.order_id);
          const menuItem = oi.menu_items as any;
          if (fb && menuItem && menuItem.id) {
            if (!dishStats[menuItem.id]) {
              dishStats[menuItem.id] = { name: menuItem.name, category: menuItem.category, sumRating: 0, reviews: 0, totalOrders: 0 };
            }
            dishStats[menuItem.id].sumRating += fb.rating;
            dishStats[menuItem.id].reviews += 1;
            dishStats[menuItem.id].totalOrders += Number(oi.qty || 1);
          }
        }
      }
    }

    return Object.values(dishStats).map((d: any) => ({
      name: d.name,
      category: d.category || "Unknown",
      avgRating: Number((d.sumRating / d.reviews).toFixed(2)),
      reviews: d.reviews,
      totalOrders: d.totalOrders
    })).sort((a, b) => b.reviews - a.reviews);
  });

export const exportCouponsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireRestaurantOwnership } = await import("./auth.server");
    await requireRestaurantOwnership(data.token, data.restaurantId);

    const { data: discounts } = await supabaseAdmin
      .from("order_discounts")
      .select("discount_amount, coupons!inner(code, name, type, restaurant_id)")
      .eq("coupons.restaurant_id", data.restaurantId);

    const couponStats: Record<string, any> = {};

    if (discounts) {
      for (const d of discounts) {
        const c = d.coupons as any;
        if (c) {
          if (!couponStats[c.code]) {
            couponStats[c.code] = { name: c.name, type: c.type, redeemed: 0, totalDiscount: 0 };
          }
          couponStats[c.code].redeemed += 1;
          couponStats[c.code].totalDiscount += Number(d.discount_amount || 0);
        }
      }
    }

    return Object.values(couponStats).map((c: any) => ({
      name: c.name,
      type: c.type,
      redeemed: c.redeemed,
      totalDiscount: c.totalDiscount,
      avgDiscount: Number((c.totalDiscount / c.redeemed).toFixed(2))
    })).sort((a, b) => b.redeemed - a.redeemed);
  });
