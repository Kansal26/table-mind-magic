import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSessionScope, findCartOrder, recalcTotals, loadOrderLines } from "@/lib/ordering.server";
import { evaluateCoupons } from "@/lib/coupons.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const qrTokenSchema = z.object({ qrToken: z.string().min(1).max(200) });
const applyCouponSchema = z.object({
  qrToken: z.string().min(1).max(200),
  couponId: z.string().uuid().nullable(),
});

export const fetchEligibleCouponsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => qrTokenSchema.parse(data))
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
  .inputValidator((data: unknown) => applyCouponSchema.parse(data))
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
  }

  await recalcTotals(order.id);
  return { success: true };
});

export const fetchAdminCouponsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: coupons, error } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return coupons || [];
  });

export const toggleCouponFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as { couponId: string; active: boolean })
  .handler(async ({ data }) => {
  await (supabaseAdmin as any).from("coupons").update({ active: data.active }).eq("id", data.couponId);
});

export const createCouponFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    restaurantId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string(),
    rule_json: z.any()
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
