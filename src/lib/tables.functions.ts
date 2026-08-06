import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const fetchAdminTablesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { data: tables, error } = await supabaseAdmin
      .from("tables")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("label", { ascending: true });
      
    if (error) throw error;
    return tables || [];
  });

export const toggleTableFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ tableId: z.string().uuid(), is_active: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("tables")
      .update({ is_active: data.is_active })
      .eq("id", data.tableId);
    if (error) throw error;
    return { ok: true };
  });

export const createTableFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    restaurantId: z.string().uuid(),
    label: z.string().min(1),
    seat_count: z.number().min(1)
  }).parse(data))
  .handler(async ({ data }) => {
    const shortRestId = data.restaurantId.substring(0, 8);
    const randomSlug = Math.random().toString(36).substring(2, 8);
    const qrToken = `${shortRestId}-t-${randomSlug}`;
    
    const { error } = await supabaseAdmin
      .from("tables")
      .insert({
        restaurant_id: data.restaurantId,
        label: data.label,
        seat_count: data.seat_count,
        qr_token: qrToken,
        is_active: true
      });
      
    if (error) throw error;
    return { ok: true };
  });
