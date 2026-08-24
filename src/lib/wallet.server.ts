import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getWalletBalance(userId: string, restaurantId: string): Promise<number> {
  // Points earned and not expired
  const { data: earnedData, error: earnedError } = await (supabaseAdmin as any)
    .from("wallet_transactions")
    .select("points")
    .eq("user_id", userId)
    .eq("restaurant_id", restaurantId)
    .gt("points", 0)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (earnedError) throw earnedError;

  // Points redeemed
  const { data: redeemedData, error: redeemedError } = await (supabaseAdmin as any)
    .from("wallet_transactions")
    .select("points")
    .eq("user_id", userId)
    .eq("restaurant_id", restaurantId)
    .lt("points", 0);

  if (redeemedError) throw redeemedError;

  const earned = (earnedData || []).reduce((sum: number, row: any) => sum + (row.points || 0), 0);
  const redeemed = (redeemedData || []).reduce((sum: number, row: any) => sum + Math.abs(row.points || 0), 0);

  return Math.max(0, earned - redeemed);
}

export async function deductWallet(userId: string, pointsToRedeem: number, reason: string, orderId: string, restaurantId: string) {
  if (pointsToRedeem <= 0) return;
  
  const current = await getWalletBalance(userId, restaurantId);
  if (current < pointsToRedeem) throw new Error("Insufficient points balance");

  // Insert transaction
  const { error: txError } = await (supabaseAdmin as any)
    .from("wallet_transactions")
    .insert({
      user_id: userId,
      restaurant_id: restaurantId,
      amount: 0,
      points: -pointsToRedeem,
      reason,
      order_id: orderId,
    });
  if (txError) throw txError;
}

export async function processFeedbackSubmission(
  orderId: string,
  userId: string,
  rating: number,
  comment?: string,
  structuredAnswers?: any
) {
  // Get the order to find the restaurant_id
  const { data: order, error: orderError } = await (supabaseAdmin as any)
    .from("orders")
    .select("restaurant_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw orderError || new Error("Order not found");
  const restaurantId = order.restaurant_id;

  // Check loyalty settings
  const { data: settings } = await (supabaseAdmin as any)
    .from("loyalty_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const isLoyaltyEnabled = settings && settings.enabled;
  let creditEarned = 0;

  if (isLoyaltyEnabled) {
    if (rating >= 1 && rating <= 5) {
      creditEarned += settings.points_for_rating || 0;
    }
    if (comment && comment.trim().length > 10) {
      creditEarned += settings.points_for_comment || 0;
    }
    if (structuredAnswers && typeof structuredAnswers === "object") {
      const answersCount = Object.keys(structuredAnswers).length;
      creditEarned += answersCount * (settings.points_for_question || 0);
    }
  }

  // 1. Insert feedback row
  const { error: feedbackError } = await (supabaseAdmin as any).from("feedback").insert({
    order_id: orderId,
    rating,
    comment,
    structured_answers: structuredAnswers,
    credit_awarded: creditEarned // Repurposing this column to store points awarded
  });

  if (feedbackError) {
    if (feedbackError.code === "23505") {
      throw new Error("409_CONFLICT");
    }
    throw feedbackError;
  }

  // 2. Add points transaction if earned
  if (isLoyaltyEnabled && creditEarned > 0) {
    let expiresAt = null;
    if (settings.points_expiry_days) {
      const date = new Date();
      date.setDate(date.getDate() + settings.points_expiry_days);
      expiresAt = date.toISOString();
    }

    await (supabaseAdmin as any).from("wallet_transactions").insert({
      user_id: userId,
      restaurant_id: restaurantId,
      amount: 0,
      points: creditEarned,
      reason: "Feedback reward",
      order_id: orderId,
      expires_at: expiresAt
    });
  }

  // For the frontend to show value
  const pointsPerRupee = settings?.points_per_rupee || 0;
  
  return { 
    creditEarned,
    pointsValue: creditEarned * pointsPerRupee,
    isLoyaltyEnabled
  };
}
