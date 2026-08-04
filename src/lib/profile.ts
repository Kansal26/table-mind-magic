import { supabase } from "@/integrations/supabase/client";

export const DIETARY_TAGS = ["veg", "non-veg", "vegan", "jain"] as const;
export const ALLERGENS = [
  "nuts",
  "dairy",
  "gluten",
  "shellfish",
  "soy",
  "egg",
  "fish",
  "sesame",
] as const;

export type Profile = {
  id: string;
  phone: string | null;
  name: string | null;
  dietary_tags: string[];
  allergens: string[];
};

/** Reads the signed-in user's own profile. RLS scopes this to `auth.uid()`. */
export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, phone, name, dietary_tags, allergens")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function saveMyProfile(input: {
  userId: string;
  phone: string | null;
  name: string;
  dietary_tags: string[];
  allergens: string[];
}): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: input.userId,
        phone: input.phone,
        name: input.name.trim() || null,
        dietary_tags: input.dietary_tags,
        allergens: input.allergens,
      },
      { onConflict: "id" },
    )
    .select("id, phone, name, dietary_tags, allergens")
    .single();
  if (error) throw error;
  return data as Profile;
}

export const profileNeedsDietaryInfo = (profile: Profile | null) =>
  !profile || (profile.dietary_tags.length === 0 && profile.allergens.length === 0);