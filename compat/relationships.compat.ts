import type { SupabaseClient } from "@supabase/supabase-js";
import { featureFlags } from "@/lib/featureFlags";
import { getRelationshipsFromFamilies } from "@/compat/family.compat";

export async function getUnifiedRelationships(supabase: SupabaseClient) {
  if (featureFlags.readFamilies) {
    return getRelationshipsFromFamilies(supabase);
  }

  const { data, error } = await supabase
    .from("relationships_active")
    .select("*");

  if (error) throw error;

  return data ?? [];
}
