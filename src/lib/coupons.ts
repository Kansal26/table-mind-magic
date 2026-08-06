import { fetchEligibleCouponsFn, applyCouponFn, fetchAdminCouponsFn, toggleCouponFn, createCouponFn } from "./coupons.functions";
import type { Coupon, CouponRule } from "./coupons.server";

export async function fetchEligibleCoupons(qrToken: string): Promise<{ coupons: Array<Coupon & { calculated_discount: number }>; applied: string | null }> {
  return await fetchEligibleCouponsFn({ data: { qrToken } }) as any;
}

export async function applyCoupon(qrToken: string, couponId: string | null) {
  return await applyCouponFn({ data: { qrToken, couponId } });
}

export async function fetchAdminCoupons(token: string, restaurantId: string): Promise<Coupon[]> {
  const { fetchAdminCouponsFn } = await import("./coupons.functions");
  const data = await fetchAdminCouponsFn({ data: { token, restaurantId } });
  return data as Coupon[];
}

export async function toggleCoupon(token: string, couponId: string, active: boolean) {
  const { toggleCouponFn } = await import("./coupons.functions");
  return await toggleCouponFn({ data: { token, couponId, active } });
}

export async function createCoupon(token: string, data: { restaurantId: string; name: string; description: string; rule_json: any }) {
  const { createCouponFn } = await import("./coupons.functions");
  await createCouponFn({ data: { ...data, token } });
}
