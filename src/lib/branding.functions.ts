import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const updateBrandingFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      restaurantId: z.string().uuid(),
      tagline: z.string().optional(),
      logo_url: z.string().nullable().optional(),
      banner_url: z.string().nullable().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    // Only update fields that were provided
    const updates: any = {};
    if (data.tagline !== undefined) updates.tagline = data.tagline;
    if (data.logo_url !== undefined) updates.logo_url = data.logo_url;
    if (data.banner_url !== undefined) updates.banner_url = data.banner_url;

    const { error } = await supabaseAdmin
      .from("restaurants")
      .update(updates)
      .eq("id", data.restaurantId);
      
    if (error) throw error;
    return { ok: true };
  });
