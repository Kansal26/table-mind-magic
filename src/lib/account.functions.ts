import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const claimSchema = z.object({
  qrToken: z.string().min(1).max(200),
  orderId: z.string().uuid(),
});

/**
 * Attaches the signed-in user to an order that belongs to their scanned table.
 * Guests never call this, so `orders.user_id` stays NULL for them.
 */
export const claimOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => claimSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { resolveTableId, requireOwnedOrder } = await import("./ordering.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tableId = await resolveTableId(data.qrToken);
    if (!tableId) throw new Error("This table code is no longer active.");

    const order = await requireOwnedOrder(tableId, data.orderId);
    if (!order) throw new Error("We couldn't find that order.");

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ user_id: context.userId })
      .eq("id", order.id);
    if (error) throw error;

    return { ok: true };
  });