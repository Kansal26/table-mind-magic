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
  .inputValidator((data: unknown) => submitFeedbackSchema.parse(data))
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

const toggleCreditsSchema = z.object({
  qrToken: z.string().min(1),
  orderId: z.string().uuid(),
  useCredits: z.boolean(),
});

export const toggleCreditsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => toggleCreditsSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recalcTotals, requireOwnedOrder, resolveTableId } = await import("./ordering.server");

    const tableId = await resolveTableId(data.qrToken);
    if (!tableId) throw new Error("Invalid table QR code");

    const order = await requireOwnedOrder(tableId, data.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "cart") throw new Error("Order is not open");

    // Only signed in users can toggle credits
    if (!order.user_id) throw new Error("Guests cannot use credits");

    const { error } = await (supabaseAdmin as any)
      .from("orders")
      .update({ use_credits: data.useCredits })
      .eq("id", order.id);
      
    if (error) throw error;

    await recalcTotals(order.id);
    return { success: true };
  });

export const checkFeedbackExistsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await (supabaseAdmin as any)
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .eq("order_id", data.orderId);
    return { exists: count && count > 0 };
  });

export const getWalletBalanceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wallet } = await (supabaseAdmin as any)
      .from("wallets")
      .select("balance")
      .eq("user_id", data.userId)
      .maybeSingle();
    return { balance: wallet ? Number(wallet.balance) : 0 };
  });
