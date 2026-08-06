import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, getSupabaseAuthClient } from "@/integrations/supabase/client.server";
import { requireRestaurantOwnership } from "./auth.server";
import { rateLimit } from "./rate-limit.server";

export const fetchAdminTablesFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const user = await requireRestaurantOwnership(data.token, data.restaurantId);
    const sb = getSupabaseAuthClient(data.token);

    const { data: tables, error } = await sb
      .from("tables")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("label", { ascending: true });
      
    if (error) throw error;
    return tables || [];
  });

export const toggleTableFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), tableId: z.string().uuid(), is_active: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    // Need to verify ownership
    const { data: table } = await supabaseAdmin.from("tables").select("restaurant_id").eq("id", data.tableId).single();
    if (!table) throw new Error("Table not found");
    const user = await requireRestaurantOwnership(data.token, table.restaurant_id);
    rateLimit(user.id, "toggleTable", 200, 15 * 60 * 1000);

    const { error } = await supabaseAdmin
      .from("tables")
      .update({ is_active: data.is_active })
      .eq("id", data.tableId);
    if (error) throw error;
    return { ok: true };
  });

export const createTableFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({
    token: z.string(),
    restaurantId: z.string().uuid(),
    label: z.string().min(1),
    seat_count: z.number().min(1)
  }).parse(data))
  .handler(async ({ data }) => {
    const user = await requireRestaurantOwnership(data.token, data.restaurantId);
    rateLimit(user.id, "createTable", 50, 15 * 60 * 1000);

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
