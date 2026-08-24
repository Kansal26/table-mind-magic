import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, getSupabaseAuthClient } from "@/integrations/supabase/client.server";
import { verifyAdminAuth } from "./auth.server";
import { rateLimit } from "./rate-limit.server";
import { sendRestaurantWelcomeEmail } from "./email.server";

export const registerRestaurantFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => 
    z.object({
      token: z.string(),
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
    const user = await verifyAdminAuth(data.token);
    // Strict rate limit for registration (e.g. 5 per day max per user)
    rateLimit(user.id, "registerRestaurant", 5, 24 * 60 * 60 * 1000);
    const sb = getSupabaseAuthClient(data.token);

    // 1. Check if user already owns a restaurant
    const { data: existing } = await sb
      .from("restaurants")
      .select("id, owner_id")
      .eq("owner_id", user.id)
      .maybeSingle();
      
    if (existing) {
      throw new Error("User already owns a restaurant");
    }

    // 2. Create the restaurant (RLS allows owner to insert)
    const { data: restaurant, error: rError } = await sb
      .from("restaurants")
      .insert({
        name: data.name,
        tagline: data.tagline ?? null,
        cuisine_type: data.cuisine_type ?? null,
        city: data.city,
        address: data.address,
        logo_url: data.logo_url ?? null,
        owner_id: user.id,
        is_active: true
      })
      .select("id")
      .single();

    if (rError) throw rError;

    // 3. Create tables
    const shortRestId = restaurant.id!.substring(0, 8);
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

    const { error: tError } = await sb
      .from("tables")
      .insert(tablesToInsert);

    if (tError) throw tError;

    // 4. Send welcome email
    try {
      const { data: { user: authUser } } = await sb.auth.getUser();
      if (authUser && authUser.email) {
        const ownerName = authUser.user_metadata?.['full_name'] || data.name;

        await sendRestaurantWelcomeEmail({
          ownerEmail: authUser.email,
          restaurantName: data.name,
          ownerName: ownerName
        });
      }
    } catch (emailError) {
      console.error('[WELCOME EMAIL] FAILED:', emailError);
    }

    return { ok: true, restaurantId: restaurant.id };
  });
