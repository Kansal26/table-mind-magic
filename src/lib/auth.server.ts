import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Securely verifies the provided Supabase JWT access token and returns the user object.
 * Throws a 401 Error if the token is invalid or missing.
 */
export async function verifyAdminAuth(token: string | undefined | null) {
  if (!token) {
    throw new Error("401: Unauthorized. Missing access token.");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !data.user) {
    throw new Error("401: Unauthorized. Invalid or expired token.");
  }

  return data.user;
}

/**
 * Validates the user's token, then strictly checks if the user is the owner
 * of the specified restaurant. Throws a 403 Error if not.
 * Returns the verified user object.
 */
export async function requireRestaurantOwnership(token: string | undefined | null, restaurantId: string) {
  const user = await verifyAdminAuth(token);

  const { data: restaurant, error } = await supabaseAdmin
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .single();

  if (error || !restaurant) {
    throw new Error("404: Restaurant not found.");
  }

  if (restaurant.owner_id !== user.id) {
    throw new Error("403: Forbidden. You do not own this restaurant.");
  }

  return user;
}
