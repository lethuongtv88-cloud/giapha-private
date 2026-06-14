"use server";

import { revalidatePath } from "next/cache";
import { getIsAdmin, getSupabase } from "@/utils/supabase/queries";

export async function confirmFamilyChildReview(familyChildId: string) {
  const isAdmin = await getIsAdmin();

  if (!isAdmin) {
    return {
      success: false,
      error: "Từ chối truy cập. Chỉ admin mới có quyền này.",
    };
  }

  if (!familyChildId) {
    return {
      success: false,
      error: "Thiếu family_child_id.",
    };
  }

  const supabase = await getSupabase();

  const { error } = await supabase
    .from("family_children")
    .update({
      migration_confidence: "manual",
    })
    .eq("id", familyChildId)
    .eq("migration_confidence", "review");

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath("/dashboard/data-maintenance/migration-review");
  revalidatePath("/dashboard/data-quality/family-model");
  revalidatePath("/dashboard/members");

  return {
    success: true,
  };
}
