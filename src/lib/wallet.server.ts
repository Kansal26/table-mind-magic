import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CREDIT_RULES = {
  base_rating: 10,
  comment_bonus: 20,
  question_bonus: 5,
  max_per_order: 35,
};

export async function getWalletBalance(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("wallets" as any)
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (error) throw error;
  return data ? Number(data.balance) : 0;
}

export async function deductWallet(userId: string, amount: number, reason: string, orderId: string) {
  if (amount <= 0) return;
  
  const current = await getWalletBalance(userId);
  if (current < amount) throw new Error("Insufficient wallet balance");

  const newBalance = current - amount;

  // Update wallet
  const { error: updateError } = await (supabaseAdmin as any)
    .from("wallets" as any)
    .update({ balance: newBalance })
    .eq("user_id", userId);
  if (updateError) throw updateError;

  // Insert transaction
  const { error: txError } = await (supabaseAdmin as any)
    .from("wallet_transactions")
    .insert({
      user_id: userId,
      amount: -amount,
      reason,
      order_id: orderId,
    });
  if (txError) throw txError;
}

export function calculateFeedbackCredit(rating: number, comment?: string, structuredAnswers?: any): number {
  let earned = 0;
  if (rating >= 1 && rating <= 5) {
    earned += CREDIT_RULES.base_rating;
  }
  if (comment && comment.trim().length > 10) {
    earned += CREDIT_RULES.comment_bonus;
  }
  // if answers are provided and not empty object
  if (structuredAnswers && Object.keys(structuredAnswers).length > 0) {
    earned += CREDIT_RULES.question_bonus;
  }
  return Math.min(earned, CREDIT_RULES.max_per_order);
}

export async function processFeedbackSubmission(
  orderId: string,
  userId: string,
  rating: number,
  comment?: string,
  structuredAnswers?: any
) {
  const creditEarned = calculateFeedbackCredit(rating, comment, structuredAnswers);

  // 1. Insert feedback row
  const { error: feedbackError } = await (supabaseAdmin as any).from("feedback").insert({
    order_id: orderId,
    rating,
    comment,
    structured_answers: structuredAnswers,
    credit_awarded: creditEarned
  });

  if (feedbackError) {
    // 23505 is PostgreSQL unique_violation error code
    if (feedbackError.code === "23505") {
      throw new Error("409_CONFLICT");
    }
    throw feedbackError;
  }

  // 2. Add credit to wallet if earned
  if (creditEarned > 0) {
    // Get existing wallet or create
    const { data: wallet } = await (supabaseAdmin as any)
      .from("wallets" as any)
      .select("id, balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (wallet) {
      await (supabaseAdmin as any)
        .from("wallets" as any)
        .update({ balance: Number(wallet.balance) + creditEarned })
        .eq("user_id", userId);
    } else {
      await (supabaseAdmin as any)
        .from("wallets")
        .insert({ user_id: userId, balance: creditEarned });
    }

    // Insert transaction
    await (supabaseAdmin as any).from("wallet_transactions").insert({
      user_id: userId,
      amount: creditEarned,
      reason: "Feedback reward",
      order_id: orderId
    });
  }

  return { creditEarned };
}
