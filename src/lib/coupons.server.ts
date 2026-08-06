import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CouponRule =
  | { type: "first_order"; discount_pct: number }
  | { type: "min_spend"; amount: number; discount_pct: number }
  | { type: "item_specific"; item_id: string; discount_pct: number }
  | { type: "time_window"; start: string; end: string; discount_pct: number };

export type Coupon = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  rule_json: CouponRule;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
};

// Returns eligible coupons and their potential discount amount
export async function evaluateCoupons(orderId: string, lines: any[], subtotal: number): Promise<Array<Coupon & { calculated_discount: number }>> {
  // Load order
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status, session:session_id(tables(restaurant_id))")
    .eq("id", orderId)
    .single();

  if (!order || !order.session || !(order.session as any).tables) return [];
  const restaurantId = (order.session as any).tables.restaurant_id;
  
  if (subtotal === 0) return []; // No discounts on empty cart

  // Fetch all active coupons for this restaurant
  const { data: couponsData } = await (supabaseAdmin as any)
    .from("coupons")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("active", true);
  
  if (!couponsData || couponsData.length === 0) return [];

  const coupons = couponsData as any as Coupon[];
  const eligible: Array<Coupon & { calculated_discount: number }> = [];

  for (const coupon of coupons) {
    let isEligible = false;
    let discountAmount = 0;
    const rule = coupon.rule_json;

    switch (rule.type) {
      case "first_order":
        if (order.user_id) {
          // Signed-in user: check if they have any paid orders
          const { count } = await supabaseAdmin
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", order.user_id)
            .eq("status", "paid");
          
          if (count === 0) {
            isEligible = true;
            discountAmount = subtotal * (rule.discount_pct / 100);
          }
        }
        // If they are a guest, they are NOT eligible (per V1 limitation decision)
        break;
      
      case "min_spend":
        if (subtotal >= rule.amount) {
          isEligible = true;
          discountAmount = subtotal * (rule.discount_pct / 100);
        }
        break;

      case "item_specific":
        const targetItem = lines.find((l) => l.menu_item.id === rule.item_id);
        if (targetItem) {
          isEligible = true;
          // Discount applies only to this specific item's total cost
          discountAmount = (targetItem.menu_item.price * targetItem.qty) * (rule.discount_pct / 100);
        }
        break;
      
      case "time_window":
        // Check if current IST time is within start and end
        const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();
        
        const [startH = 0, startM = 0] = rule.start.split(":").map(Number);
        const [endH = 23, endM = 59] = rule.end.split(":").map(Number);
        
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
          isEligible = true;
          discountAmount = subtotal * (rule.discount_pct / 100);
        }
        break;
    }

    if (isEligible && discountAmount > 0) {
      eligible.push({ ...coupon, calculated_discount: Math.round(discountAmount * 100) / 100 });
    }
  }

  return eligible;
}
