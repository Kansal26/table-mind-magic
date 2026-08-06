import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const fetchAdminMenuFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { data: items, error } = await supabaseAdmin
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
  .inputValidator((data: unknown) => 
    z.object({
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
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("menu_items")
        .update(data)
        .eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("menu_items")
        .insert(data);
      if (error) throw error;
    }
    return { ok: true };
  });

export const softDeleteMenuItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ itemId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("menu_items")
      .update({ available: false, is_deleted: true })
      .eq("id", data.itemId);
    if (error) throw error;
    return { ok: true };
  });
