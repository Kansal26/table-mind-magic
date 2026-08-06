import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, getSupabaseAuthClient } from "@/integrations/supabase/client.server";
import { verifyAdminAuth, requireRestaurantOwnership } from "./auth.server";
import { rateLimit } from "./rate-limit.server";

export const fetchAdminMenuFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const user = await requireRestaurantOwnership(data.token, data.restaurantId);
    const sb = getSupabaseAuthClient(data.token);

    const { data: items, error } = await sb
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .eq("is_deleted", false)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
      
    if (error) throw error;
    return items || [];
  });

export const upsertMenuItemFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => 
    z.object({
      token: z.string(),
      id: z.string().uuid().optional(),
      restaurant_id: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().nullable(),
      price: z.number().min(0),
      category: z.string().min(1),
      image_url: z.string().nullable(),
      allergens: z.array(z.string()),
      dietary_tags: z.array(z.string()),
      prep_time_min: z.number().nullable(),
      badge: z.string().nullable(),
      is_featured: z.boolean(),
      sort_order: z.number(),
      available: z.boolean()
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const user = await requireRestaurantOwnership(data.token, data.restaurant_id);
    rateLimit(user.id, "upsertMenuItem", 100, 15 * 60 * 1000);

    const { token, ...itemData } = data;

    if (itemData.id) {
      const { error } = await supabaseAdmin
        .from("menu_items")
        .update(itemData)
        .eq("id", itemData.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("menu_items")
        .insert(itemData);
      if (error) throw error;
    }
    return { ok: true };
  });

export const softDeleteMenuItemFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ token: z.string(), itemId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const user = await verifyAdminAuth(data.token);
    rateLimit(user.id, "softDeleteMenuItem", 100, 15 * 60 * 1000);
    
    // Verify ownership
    const { data: item } = await supabaseAdmin.from("menu_items").select("restaurant_id").eq("id", data.itemId).single();
    if (!item) throw new Error("Item not found");
    await requireRestaurantOwnership(data.token, item.restaurant_id);

    const { error } = await supabaseAdmin
      .from("menu_items")
      .update({ available: false, is_deleted: true })
      .eq("id", data.itemId);
    if (error) throw error;
    return { ok: true };
  });
