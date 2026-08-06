import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const registerRestaurantFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      userId: z.string().uuid(),
      name: z.string().min(1),
      tagline: z.string().optional(),
      cuisine_type: z.string().optional(),
      city: z.string().min(1),
      address: z.string().min(1),
      logo_url: z.string().optional(),
      numTables: z.number().min(1).max(50)
    }).parse(data)
  )
  .handler(async ({ data }) => {
    // 1. Check if user already owns a restaurant
    const { data: existing } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", data.userId)
      .maybeSingle();
      
    if (existing) {
      throw new Error("User already owns a restaurant");
    }

    // 2. Create the restaurant
    const { data: restaurant, error: rError } = await supabaseAdmin
      .from("restaurants")
      .insert({
        name: data.name,
        tagline: data.tagline,
        cuisine_type: data.cuisine_type,
        city: data.city,
        address: data.address,
        logo_url: data.logo_url,
        owner_id: data.userId,
        is_active: true
      })
      .select("id")
      .single();

    if (rError) throw rError;

    // 3. Create tables
    const shortRestId = restaurant.id.substring(0, 8);
    const tablesToInsert = [];
    for (let i = 1; i <= data.numTables; i++) {
      // Use a short random string appended to make it globally unique yet short
      const randomSlug = Math.random().toString(36).substring(2, 8);
      const qrToken = `${shortRestId}-t${i}-${randomSlug}`;
      
      tablesToInsert.push({
        restaurant_id: restaurant.id,
        label: `Table ${i}`,
        qr_token: qrToken,
        seat_count: 4,
        is_active: true
      });
    }

    const { error: tError } = await supabaseAdmin
      .from("tables")
      .insert(tablesToInsert);

    if (tError) throw tError;

    return { ok: true, restaurantId: restaurant.id };
  });
