import { createServerFn } from "@tanstack/react-start";
import Groq from "groq-sdk";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import Razorpay from "razorpay";
import crypto from "crypto";

const qrTokenSchema = z.object({ qrToken: z.string().min(1).max(200) });

const addToCartSchema = z.object({
  qrToken: z.string().min(1).max(200),
  menuItemId: z.string().uuid(),
  qty: z.number().int().min(1).max(50),
  notes: z.string().max(500).optional(),
  allergyOverrideAck: z.boolean().optional(),
  deviceToken: z.string().optional(),
});

const joinSessionSchema = z.object({
  qrToken: z.string().min(1).max(200),
  deviceToken: z.string(),
  participantName: z.string().optional(),
});

const lineQtySchema = z.object({
  qrToken: z.string().min(1).max(200),
  lineId: z.string().uuid(),
  qty: z.number().int().min(0).max(50),
});

const orderSchema = z.object({
  qrToken: z.string().min(1).max(200),
  orderId: z.string().uuid(),
  guestEmail: z.string().email().optional(),
});

const verifyRazorpaySchema = z.object({
  qrToken: z.string(),
  orderId: z.string().uuid(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  guestEmail: z.string().email().optional(),
});

export const resolveTableFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => qrTokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireSessionScope } = await import("./ordering.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const scope = await requireSessionScope(data.qrToken);
    if (!scope) return null;

    const { data: table, error } = await supabaseAdmin
      .from("tables")
      .select("id, label, restaurant_id, restaurants(name, address, tagline, logo_url, banner_url)")
      .eq("id", scope.tableId)
      .maybeSingle();
    if (error) throw error;
    if (!table) return null;

    const restaurant = table.restaurants as unknown as {
      name: string;
      address: string | null;
      tagline: string | null;
      logo_url: string | null;
      banner_url: string | null;
    } | null;

    return {
      tableId: table.id,
      tableLabel: table.label ?? "Your table",
      restaurantId: table.restaurant_id,
      restaurantName: restaurant?.name ?? "Restaurant",
      restaurantAddress: restaurant?.address ?? null,
      restaurantTagline: restaurant?.tagline ?? null,
      restaurantLogo: restaurant?.logo_url ?? null,
      restaurantBanner: restaurant?.banner_url ?? null,
      sessionId: scope.sessionId,
    };
  });

export const joinSessionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => joinSessionSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireSessionScope, recordSessionActivity } = await import("./ordering.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const scope = await requireSessionScope(data.qrToken);
    if (!scope) throw new Error("Invalid table QR code");

    let userId = null;
    let authName = null;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const { data: authData } = await supabaseAdmin.auth.getUser(token);
        if (authData.user) {
          userId = authData.user.id;
          const { data: profile } = await supabaseAdmin.from("profiles").select("name").eq("id", userId).maybeSingle();
          if (profile?.name) authName = profile.name;
        }
      }
    } catch (e) {
      // Ignore
    }

    // Check if participant exists
    const { data: existing } = await supabaseAdmin
      .from("session_participants")
      .select("*")
      .eq("session_id", scope.sessionId)
      .eq("device_token", data.deviceToken)
      .maybeSingle();

    let participantName = authName ?? existing?.guest_name;

    if (existing) {
      await recordSessionActivity(scope.sessionId);
      return { isReturning: true, sessionId: scope.sessionId, participantName };
    }

    // Get current participant count
    const { count: currentCount } = await supabaseAdmin
      .from("session_participants")
      .select("*", { count: 'exact', head: true })
      .eq("session_id", scope.sessionId);
      
    const count = currentCount ?? 0;
    if (!participantName) {
      participantName = data.participantName || `Guest ${count + 1}`;
    }

    await supabaseAdmin.from("session_participants").insert({
      session_id: scope.sessionId,
      user_id: userId,
      device_token: data.deviceToken,
      guest_name: participantName,
    });

    await supabaseAdmin
      .from("sessions")
      .update({ participant_count: count + 1 })
      .eq("id", scope.sessionId);

    await recordSessionActivity(scope.sessionId);

    return { isReturning: false, sessionId: scope.sessionId, participantName };
  });

export const fetchCartFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => qrTokenSchema.parse(data))
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
  .validator((data: unknown) => addToCartSchema.parse(data))
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

    // Extract user ID if signed in
    let userId = null;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const { data: authData } = await supabaseAdmin.auth.getUser(token);
        userId = authData.user?.id ?? null;
      }
    } catch (e) {
      // Ignore auth errors, fallback to guest
    }

    const orderId = await ensureCartOrder(scope.sessionId, userId);
    
    // Get participant info if device token provided
    let participantName = null;
    if (data.deviceToken) {
      const { data: participant } = await supabaseAdmin
        .from("session_participants")
        .select("guest_name, user_id")
        .eq("session_id", scope.sessionId)
        .eq("device_token", data.deviceToken)
        .maybeSingle();
      if (participant) {
        if (participant.user_id) {
          const { data: profile } = await supabaseAdmin.from("profiles").select("name").eq("id", participant.user_id).maybeSingle();
          if (profile?.name) participantName = profile.name;
        } else {
          participantName = participant.guest_name;
        }
      }
    }

    const notes = data.notes?.trim();
    const { error } = await (supabaseAdmin as any).from("order_items").insert({
      order_id: orderId,
      menu_item_id: item.id,
      qty: data.qty,
      customizations: notes ? { notes } : {},
      allergy_override_ack: data.allergyOverrideAck ?? false,
      added_by_user_id: userId,
      added_by_name: participantName,
      added_by_device_token: data.deviceToken || null,
    });
    
    if (error) {
      if (error.message.includes("ALLERGY_WARNING")) {
        return { orderId: null, requiresAllergyAck: true, message: error.message };
      }
      throw error;
    }

    const { recordSessionActivity } = await import("./ordering.server");
    await recordSessionActivity(scope.sessionId);

    await recalcTotals(orderId);
    return { orderId, requiresAllergyAck: false, message: null };
  });

const recommendationsSchema = z.object({
  qrToken: z.string().min(1).max(200),
});

export const getRecommendationsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => recommendationsSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireSessionScope } = await import("./ordering.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const scope = await requireSessionScope(data.qrToken);
    if (!scope) return [];

    let userId = null;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const { data: authData } = await supabaseAdmin.auth.getUser(token);
        userId = authData.user?.id ?? null;
      }
    } catch (e) {}

    if (!userId) return [];

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("allergens, dietary_tags")
      .eq("id", userId)
      .maybeSingle();
    
    const userAllergens = (profile?.allergens || []).map((a: any) => String(a).toLowerCase().trim());
    const userDietaryTags = (profile?.dietary_tags || []).map((d: any) => String(d).toLowerCase().trim());

    // Get all available items for the restaurant
    const { data: allItems } = await supabaseAdmin
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", scope.restaurantId)
      .eq("available", true);
      
    if (!allItems) return [];

    // Hard Filter: Remove items with allergens
    const safeItems = allItems.filter(item => {
      const itemAllergens = (item.allergens || []).map((a: any) => String(a).toLowerCase().trim());
      const hasIntersection = itemAllergens.some((a: any) => userAllergens.includes(a));
      return !hasIntersection;
    });

    const recommendations: { item: any, reason: string, source: string }[] = [];
    const addedIds = new Set<string>();

    const addRec = (item: any, reason: string, source: string = "rule") => {
      if (recommendations.length < 5 && !addedIds.has(item.id)) {
        recommendations.push({ item, reason, source });
        addedIds.add(item.id);
      }
    };

    // Pre-fetch current cart
    const { data: currentCart } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("session_id", scope.sessionId)
      .eq("status", "cart")
      .maybeSingle();

    let cartItemIds: string[] = [];
    if (currentCart) {
      const { data: cartItems } = await supabaseAdmin
        .from("order_items")
        .select("menu_item_id")
        .eq("order_id", currentCart.id);
      cartItemIds = cartItems?.map(ci => ci.menu_item_id) || [];
    }

    const cartItemNames = cartItemIds.map(id => allItems.find(i => i.id === id)?.name).filter(Boolean) as string[];

    // --- GLOBAL PRIORITY 1: Your most ordered dish ---
    const { data: pastOrders } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "paid");

    if (pastOrders && pastOrders.length > 0) {
      const orderIds = pastOrders.map(o => o.id);
      const { data: pastItems } = await supabaseAdmin
        .from("order_items")
        .select("menu_item_id")
        .in("order_id", orderIds);
        
      if (pastItems && pastItems.length > 0) {
        const counts: Record<string, number> = {};
        for (const pi of pastItems) {
          counts[pi.menu_item_id] = (counts[pi.menu_item_id] || 0) + 1;
        }
        const sortedPast = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        for (const [itemId, _] of sortedPast) {
          const item = safeItems.find(i => i.id === itemId);
          if (item && !cartItemIds.includes(itemId)) {
            addRec(item, "Your most ordered dish", "rule");
            break; // Only the absolute top item
          }
        }
      }
    }
      
    let useRuleFallback = true;

    // --- LLM ENGINE (Priority 2) ---
    if (pastOrders && pastOrders.length >= 2) {
      try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error("GROQ_API_KEY is missing");
        const groq = new Groq({ apiKey });

        const orderIds = pastOrders.map(o => o.id);
        const { data: pastItems } = await supabaseAdmin
          .from("order_items")
          .select("menu_items(name)")
          .in("order_id", orderIds);
        const pastItemNames = pastItems?.map((pi: any) => pi.menu_items?.name) || [];

        const { data: alreadyShown } = await supabaseAdmin
          .from("recommendation_logs")
          .select("item_id")
          .eq("session_id", scope.sessionId);
        const alreadyShownIds = new Set((alreadyShown || []).map(r => r.item_id));

        const menuContext = safeItems.map(i => `[ID: ${i.id}] ${i.name} - ${i.category}`).join("\n");

        const prompt = `You are a restaurant recommendation assistant.
Based on the user's history and current cart, recommend up to 5 items from the menu.

USER HISTORY:
Past ordered items: ${pastItemNames.join(", ") || "None"}
Current cart items: ${cartItemNames.join(", ") || "None"}
Dietary Tags: ${userDietaryTags.join(", ") || "None"}
Allergens: ${userAllergens.join(", ") || "None"}

MENU:
${menuContext}

IMPORTANT RULES:
1. DO NOT recommend any item that conflicts with the user's Allergens.
2. DO NOT recommend items that are already in the Current cart.
3. Provide a brief 1-line personalized reason for each recommendation.
4. Return ONLY a JSON object with this schema:
{
  "recommendations": [
    { "menu_item_id": "string", "reason": "string" }
  ]
}
`;
        const responsePromise = groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: prompt }],
          response_format: { type: "json_object" }
        });

        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000));
        const response = await Promise.race([responsePromise, timeoutPromise]);
        
        const text = response.choices[0]?.message?.content;
        if (!text) throw new Error("Empty LLM response");

        const parsed = JSON.parse(text) as { recommendations: { menu_item_id: string, reason: string }[] };
        
        let addedLlm = 0;
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          for (const rec of parsed.recommendations) {
            const item = safeItems.find(i => i.id === rec.menu_item_id);
            if (item && !cartItemNames.includes(item.name) && !alreadyShownIds.has(item.id)) {
              addRec(item, rec.reason, "llm");
              addedLlm++;
            }
          }
        }
        
        if (addedLlm > 0) {
          useRuleFallback = false;
        }
      } catch (err) {
        console.error("LLM Recs Error:", err);
      }
    }

    // --- RULE-BASED FALLBACK ENGINE ---
    if (useRuleFallback) {
      // Rule 1: Ordered before
      if (pastOrders && pastOrders.length > 0) {
        const orderIds = pastOrders.map(o => o.id);
        const { data: pastItems } = await supabaseAdmin
          .from("order_items")
          .select("menu_item_id")
          .in("order_id", orderIds);
          
        if (pastItems) {
          const counts: Record<string, number> = {};
          for (const pi of pastItems) {
            counts[pi.menu_item_id] = (counts[pi.menu_item_id] || 0) + 1;
          }
          const sortedPast = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          for (const [itemId, _] of sortedPast) {
            const item = safeItems.find(i => i.id === itemId);
            if (item) addRec(item, "You ordered this before");
          }
        }
      }

      // Rule 2: Co-occurrence with current cart
      if (cartItemIds.length > 0) {
        const { data: coOrders } = await supabaseAdmin
          .from("order_items")
          .select("order_id")
          .in("menu_item_id", cartItemIds);
          
        if (coOrders && coOrders.length > 0) {
          const coOrderIds = [...new Set(coOrders.map(co => co.order_id))];
          if (coOrderIds.length > 0) {
            const { data: coItems } = await supabaseAdmin
              .from("order_items")
              .select("menu_item_id")
              .in("order_id", coOrderIds);
              
            if (coItems) {
              const counts: Record<string, number> = {};
              for (const ci of coItems) {
                if (!cartItemIds.includes(ci.menu_item_id)) {
                  counts[ci.menu_item_id] = (counts[ci.menu_item_id] || 0) + 1;
                }
              }
              const sortedCo = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              for (const [itemId, _] of sortedCo) {
                const item = safeItems.find(i => i.id === itemId);
                if (item) addRec(item, "Frequently ordered together");
              }
            }
          }
        }
      }

      // Rule 2.5: Highly Rated
      const { data: allFeedback } = await supabaseAdmin
        .from("feedback")
        .select("order_id, rating")
        .not("rating", "is", null);

      if (allFeedback && allFeedback.length > 0) {
        const fbOrderIds = allFeedback.map(f => f.order_id);
        const { data: fbOrderItems } = await supabaseAdmin
          .from("order_items")
          .select("menu_item_id, order_id")
          .in("order_id", fbOrderIds);
          
        if (fbOrderItems && fbOrderItems.length > 0) {
          const itemRatings: Record<string, { sum: number, count: number }> = {};
          for (const fboi of fbOrderItems) {
            const fb = allFeedback.find(f => f.order_id === fboi.order_id);
            if (fb && fb.rating != null) {
              if (!itemRatings[fboi.menu_item_id]) itemRatings[fboi.menu_item_id] = { sum: 0, count: 0 };
              itemRatings[fboi.menu_item_id].sum += fb.rating;
              itemRatings[fboi.menu_item_id].count += 1;
            }
          }
          
          for (const [itemId, stats] of Object.entries(itemRatings)) {
            if (stats.count >= 3 && (stats.sum / stats.count) >= 4.5) {
              const item = safeItems.find(i => i.id === itemId);
              if (item && !cartItemIds.includes(itemId)) {
                addRec(item, "Highly rated by diners", "rule");
              }
            }
          }
        }
      }

      // Rule 3: Dietary Tags
      if (userDietaryTags.length > 0) {
        for (const item of safeItems) {
          const itemTags = (item.dietary_tags || []).map((t: any) => String(t).toLowerCase().trim());
          const hasTag = itemTags.some((t: any) => userDietaryTags.includes(t));
          if (hasTag) addRec(item, "Matches your dietary preferences");
        }
      }

      // Rule 3.5: Popular this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const { data: recentOrders } = await supabaseAdmin
        .from("orders")
        .select("id")
        .gte("created_at", oneWeekAgo.toISOString());
        
      if (recentOrders && recentOrders.length > 0) {
        const recentOrderIds = recentOrders.map(o => o.id);
        const { data: recentItems } = await supabaseAdmin
          .from("order_items")
          .select("menu_item_id")
          .in("order_id", recentOrderIds);
          
        if (recentItems && recentItems.length > 0) {
          const counts: Record<string, number> = {};
          for (const ri of recentItems) {
            counts[ri.menu_item_id] = (counts[ri.menu_item_id] || 0) + 1;
          }
          const sortedRecent = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
          for (const [itemId, _] of sortedRecent) {
            const item = safeItems.find(i => i.id === itemId);
            if (item && !cartItemIds.includes(itemId)) {
              addRec(item, "Popular this week", "rule");
            }
          }
        }
      }

      // Rule 4: Popular overall (fallback)
      for (const item of safeItems) {
        addRec(item, "Popular choice");
      }

    } // end useRuleFallback

    // Fetch Kitchen Load
    const { getKitchenLoad } = await import("./admin.functions");
    const kitchenLoad = await getKitchenLoad();

    if (kitchenLoad.level === "high") {
      // Deprioritize slow prep items, label fast prep items
      for (const rec of recommendations) {
        const prepTime = rec.item.prep_time_min || 10;
        if (prepTime <= 15) {
          rec.reason = rec.reason + " (Quick to prepare)";
        }
      }
      recommendations.sort((a, b) => {
        const aTime = a.item.prep_time_min || 10;
        const bTime = b.item.prep_time_min || 10;
        const aSlow = aTime > 15;
        const bSlow = bTime > 15;
        if (aSlow && !bSlow) return 1;
        if (!aSlow && bSlow) return -1;
        return 0; // keep relative order otherwise
      });
    }

    // Log recommendations
    const recsToLog = recommendations.map(r => ({
      user_id: userId,
      session_id: scope.sessionId,
      item_id: r.item.id,
      reason: r.reason,
      source: r.source
    }));

    if (recsToLog.length > 0) {
      await (supabaseAdmin as any).from("recommendation_logs").insert(recsToLog);
    }

    return recommendations.map(r => ({ ...r.item, price: Number(r.item.price), _reason: r.reason }));
  });

export const setLineQtyFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => lineQtySchema.parse(data))
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

    const { recordSessionActivity } = await import("./ordering.server");
    await recordSessionActivity(scope.sessionId);

    await recalcTotals(order.id);
    return { ok: true };
  });

export const fetchBillFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => orderSchema.parse(data))
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
        discount_amount: Number(order.discount_amount),
        credits_applied: Number(order.credits_applied),
        use_credits: Boolean(order.use_credits),
      },
      lines: await loadOrderLines(order.id),
    };
  });

export const payOrderFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => orderSchema.parse(data))
  .handler(async ({ data }) => {
    console.log('[PAY] payOrderFn called');
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

    // Fetch the updated order to get the final credits_applied
    const { data: updatedOrder } = await (supabaseAdmin as any)
      .from("orders")
      .select("credits_applied, user_id")
      .eq("id", order.id)
      .single();

    if (updatedOrder && updatedOrder.credits_applied > 0 && updatedOrder.user_id) {
      const { deductWallet } = await import("./wallet.server");
      await deductWallet(updatedOrder.user_id, updatedOrder.credits_applied, "Redeemed on order", order.id);
    }

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

    // Trigger email notification for owner (and guest if provided)
    if (data.guestEmail) {
      await supabaseAdmin
        .from("orders")
        .update({ guest_email: data.guestEmail })
        .eq("id", data.orderId);
    }

    try {
      const { data: orderData } = await supabaseAdmin
        .from("orders")
        .select(`
          total, subtotal, tax, discount_amount, credits_applied,
          sessions (
            tables (
              label,
              restaurants (
                name,
                owner_id
              )
            )
          ),
          order_items (
            qty,
            customizations,
            menu_items (
              name
            )
          )
        `)
        .eq("id", data.orderId)
        .single();
      
      if (orderData?.sessions?.tables) {
        const table = orderData.sessions.tables;
        const restaurant = table.restaurants;
        const ownerId = restaurant?.owner_id;
        
        const items = orderData.order_items.map((oi: any) => ({
          name: oi.menu_items?.name || "Unknown Item",
          qty: oi.qty,
          customizations: oi.customizations
        }));

        if (ownerId) {
          const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(ownerId);
          let ownerEmail = ownerData?.user?.email;

          if (!ownerEmail && process.env.RESTAURANT_NOTIFICATION_EMAIL) {
            ownerEmail = process.env.RESTAURANT_NOTIFICATION_EMAIL;
          }

          if (ownerEmail) {
            const { sendNewOrderNotification, sendGuestReceiptEmail } = await import("./email.server");
            await sendNewOrderNotification({
              restaurantName: restaurant?.name || "Restaurant",
              tableName: table.label || "Table",
              orderItems: items,
              subtotal: Number(orderData.subtotal),
              discount: Number(orderData.discount_amount),
              total: Number(orderData.total),
              ownerEmail: ownerEmail,
              orderId: order.id
            });

            if (data.guestEmail) {
              await sendGuestReceiptEmail({
                guestEmail: data.guestEmail,
                restaurantName: restaurant?.name || "Restaurant",
                tableName: table.label || "Table",
                orderItems: items,
                subtotal: Number(orderData.subtotal),
                discount: Number(orderData.discount_amount),
                creditsApplied: Number(orderData.credits_applied || 0),
                tax: Number(orderData.tax),
                total: Number(orderData.total),
                orderId: order.id
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to trigger order emails:", e);
    }

    return { ok: true };
  });

export const createRazorpayOrderFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => orderSchema.parse(data))
  .handler(async ({ data }) => {
    const { resolveTableId, requireOwnedOrder } = await import("./ordering.server");

    const tableId = await resolveTableId(data.qrToken);
    if (!tableId) throw new Error("This table code is no longer active.");

    const order = await requireOwnedOrder(tableId, data.orderId);
    if (!order) throw new Error("We couldn't find that bill.");
    if (order.status === "paid") throw new Error("Order already paid.");

    const amountPaise = Math.round(Number(order.total) * 100);
    if (amountPaise < 100) throw new Error("Amount must be at least ₹1.00");

    const keyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error(`Missing Razorpay API Keys in backend. ID present: ${!!keyId}, Secret present: ${!!keySecret}. Please restart your dev server.`);
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const options = {
      amount: amountPaise,
      currency: "INR",
      // Razorpay receipt limit is 40 chars. UUID is 36 chars.
      receipt: `rcpt_${order.id.split('-')[0]}`,
    };

    try {
      const rpOrder = await razorpay.orders.create(options);
      return {
        order_id: rpOrder.id as string,
        amount: rpOrder.amount as number,
        currency: rpOrder.currency as string,
      };
    } catch (e: any) {
      console.error("Razorpay Error:", e);
      // Attempt to extract Razorpay's specific error message if it exists
      const errorMsg = e?.error?.description || e?.message || "Failed to create Razorpay order";
      throw new Error(`Razorpay: ${errorMsg}`);
    }
  });

export const verifyRazorpayPaymentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => verifyRazorpaySchema.parse(data))
  .handler(async ({ data }) => {
    console.log('[PAY] verifyRazorpayPaymentFn called');
    const { resolveTableId, requireOwnedOrder, recalcTotals } = await import("./ordering.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    console.log('[PAY] Step 1: Starting verification');
    const tableId = await resolveTableId(data.qrToken);
    if (!tableId) throw new Error("This table code is no longer active.");

    const order = await requireOwnedOrder(tableId, data.orderId);
    if (!order) throw new Error("We couldn't find that bill.");
    if (order.status === "paid") {
      console.log('[PAY] Order already paid. Returning early!');
      return { ok: true };
    }

    try {
      const body = data.razorpay_order_id + "|" + data.razorpay_payment_id;
      const crypto = await import("crypto");
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
        .update(body.toString())
        .digest("hex");

      if (expectedSignature !== data.razorpay_signature) {
        throw new Error("Invalid signature. Payment verification failed.");
      }
      console.log('[PAY] Step 2: Signature verified');
    } catch (e) {
      console.error('[PAY] Step 2 FAILED:', e);
      throw e;
    }

    console.log('[PAY] Step 3: Updating order status');
    try {
      await recalcTotals(order.id);

      // Fetch the updated order to get the final credits_applied
      const { data: updatedOrder } = await (supabaseAdmin as any)
        .from("orders")
        .select("credits_applied, user_id")
        .eq("id", order.id)
        .single();

      if (updatedOrder && updatedOrder.credits_applied > 0 && updatedOrder.user_id) {
        const { deductWallet } = await import("./wallet.server");
        await deductWallet(updatedOrder.user_id, updatedOrder.credits_applied, "Redeemed on order", order.id);
      }

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
      
      console.log('[PAY] Step 4: Order status updated');
    } catch (e) {
      console.error('[PAY] Step 4 FAILED:', e);
      throw e;
    }

    console.log('[PAY] Step 5: Fetching restaurant/email data');
    try {
      const { sendNewOrderNotification, sendGuestReceiptEmail } = await import("./email.server");
      
      const { data: tableData } = await (supabaseAdmin as any)
        .from("tables")
        .select("label, restaurant_id")
        .eq("id", tableId)
        .single();
        
      if (!tableData) console.log('[PAY] DIAGNOSTIC: tableData is falsy');
        
      if (tableData) {
        const { data: restData } = await (supabaseAdmin as any)
          .from("restaurants")
          .select("name, owner_id")
          .eq("id", tableData.restaurant_id)
          .single();
          
        if (!restData) console.log('[PAY] DIAGNOSTIC: restData is falsy');
          
        if (restData) {
          let ownerEmail = process.env.RESTAURANT_NOTIFICATION_EMAIL;
          console.log('[PAY] DIAGNOSTIC: Fallback email from env:', ownerEmail);
          
          if (restData.owner_id) {
            console.log('[PAY] DIAGNOSTIC: Fetching owner email for ID:', restData.owner_id);
            const { data: { user: ownerUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(restData.owner_id);
            if (userError) console.error('[PAY] DIAGNOSTIC: getUserById error:', userError);
            if (ownerUser?.email) {
              ownerEmail = ownerUser.email;
              console.log('[PAY] DIAGNOSTIC: Found owner email from auth:', ownerEmail);
            } else {
              console.log('[PAY] DIAGNOSTIC: ownerUser or ownerUser.email is missing');
            }
          }
          
          if (!ownerEmail) console.log('[PAY] DIAGNOSTIC: ownerEmail is falsy');
          
          if (ownerEmail) {
            const { data: items } = await (supabaseAdmin as any)
              .from("order_items")
              .select("qty, customizations, menu_items(name)")
              .eq("order_id", order.id);
              
            const formattedItems = (items || []).map((i: any) => ({
              name: i.menu_items?.name || "Unknown Item",
              qty: i.qty,
              customizations: i.customizations
            }));

            console.log('[PAY] Step 6: Data fetched, sending email');
            console.log('[Email] Attempting to send order notification...');
            console.log('[Email] Restaurant:', restData.name);
            console.log('[Email] Owner email:', ownerEmail);
            
            const result = await sendNewOrderNotification({
              restaurantName: restData.name,
              tableName: tableData.label,
              orderItems: formattedItems,
              subtotal: Number(order.subtotal || 0),
              discount: Number(order.discount_total || 0),
              total: Number(order.total || 0),
              ownerEmail,
              orderId: order.id
            });
            console.log('[Email] Result:', result);

            if (data.guestEmail) {
              // We need to fetch credits_applied and tax which aren't in `order` var natively here, or wait `order` is fetched at the top via `requireOwnedOrder` which has `total`, `subtotal`, `tax`, `discount_amount`, `credits_applied`
              // The `order` object from `requireOwnedOrder` has `total`, `subtotal`, `tax`, `discount_amount`, `credits_applied`.
              await sendGuestReceiptEmail({
                guestEmail: data.guestEmail,
                restaurantName: restData.name || "Restaurant",
                tableName: tableData.label || "Table",
                orderItems: formattedItems,
                subtotal: Number(order.subtotal || 0),
                discount: Number(order.discount_amount || 0),
                creditsApplied: Number(order.credits_applied || 0),
                tax: Number(order.tax || 0),
                total: Number(order.total || 0),
                orderId: order.id
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('[PAY] Step 6 FAILED:', e);
      throw e;
    }

    return { ok: true };
  });
