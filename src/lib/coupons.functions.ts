import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSessionScope, findCartOrder, recalcTotals, loadOrderLines } from "@/lib/ordering.server";
import { evaluateCoupons } from "@/lib/coupons.server";
import { supabaseAdmin, getSupabaseAuthClient } from "@/integrations/supabase/client.server";
import { requireRestaurantOwnership } from "./auth.server";
import { rateLimit } from "./rate-limit.server";

const qrTokenSchema = z.object({ qrToken: z.string().min(1).max(200) });
const applyCouponSchema = z.object({
  qrToken: z.string().min(1).max(200),
  couponId: z.string().uuid().nullable(),
});

export const fetchEligibleCouponsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => qrTokenSchema.parse(data))
  .handler(async ({ data }) => {
  const scope = await requireSessionScope(data.qrToken);
  if (!scope) throw new Error("Invalid table QR code");

  const order = await findCartOrder(scope.sessionId);
  if (!order) return { coupons: [], applied: null };

  const lines = await loadOrderLines(order.id);
  const eligibleCoupons = await evaluateCoupons(order.id, lines, order.subtotal);

  const { data: currentDiscount } = await (supabaseAdmin as any)
    .from("order_discounts")
    .select("coupon_id, discount_amount")
    .eq("order_id", order.id)
    .single();

  return {
    coupons: eligibleCoupons,
    applied: currentDiscount ? currentDiscount.coupon_id : null,
  };
});

export const applyCouponFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => applyCouponSchema.parse(data))
  .handler(async ({ data }) => {
  const scope = await requireSessionScope(data.qrToken);
  if (!scope) throw new Error("Invalid table QR code");

  const order = await findCartOrder(scope.sessionId);
  if (!order) throw new Error("Cart not found");

  // Remove existing coupon if any
  await (supabaseAdmin as any).from("order_discounts").delete().eq("order_id", order.id);

  if (data.couponId) {
    const lines = await loadOrderLines(order.id);
    const eligibleCoupons = await evaluateCoupons(order.id, lines, order.subtotal);
    const target = eligibleCoupons.find(c => c.id === data.couponId);
    if (!target) throw new Error("Coupon is not eligible");

    await (supabaseAdmin as any).from("order_discounts").insert({
      order_id: order.id,
      coupon_id: data.couponId,
      discount_amount: target.calculated_discount
    });
  } else {
    // Explicitly record that no coupon should be applied
    await (supabaseAdmin as any).from("order_discounts").insert({
      order_id: order.id,
      coupon_id: null,
      discount_amount: 0
    });
  }

  await recalcTotals(order.id);
  return { success: true };
});

export const fetchAdminCouponsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const user = await requireRestaurantOwnership(data.token, data.restaurantId);
    const sb = getSupabaseAuthClient(data.token);

    const { data: coupons, error } = await sb
      .from("coupons")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return coupons || [];
  });

export const toggleCouponFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), couponId: z.string().uuid(), active: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { data: coupon } = await supabaseAdmin.from("coupons").select("restaurant_id").eq("id", data.couponId).single();
    if (!coupon) throw new Error("Coupon not found");
    const user = await requireRestaurantOwnership(data.token, coupon.restaurant_id);
    rateLimit(user.id, "toggleCoupon", 200, 15 * 60 * 1000);

    await supabaseAdmin.from("coupons").update({ active: data.active }).eq("id", data.couponId);
});

export const createCouponFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({
    token: z.string(),
    restaurantId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string(),
    rule_json: z.any()
  }).parse(data))
  .handler(async ({ data }) => {
    const user = await requireRestaurantOwnership(data.token, data.restaurantId);
    rateLimit(user.id, "createCoupon", 100, 15 * 60 * 1000);

    const { error } = await supabaseAdmin
      .from("coupons")
      .insert({
        restaurant_id: data.restaurantId,
        name: data.name,
        description: data.description,
        rule_json: data.rule_json,
        active: true
      });
      
    if (error) throw error;
    return { ok: true };
  });
