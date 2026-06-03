"use server";

import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteMemberProfile(memberId: string) {
  const profile = await getProfile();
  const supabase = await getSupabase();

  if (profile?.role !== "admin" && profile?.role !== "editor") {
    return {
      error: "Từ chối truy cập. Chỉ Admin hoặc Editor mới có quyền xoá hồ sơ.",
    };
  }

  // 2. Check for existing relationships
  const { data: relationships, error: relationshipError } = await supabase
   .from("relationships")
   .select("id")
   .or(`person_a.eq.${memberId},person_b.eq.${memberId}`)
   .is("deleted_at", null)
   .limit(1);

  if (relationshipError) {
    console.error("Error checking relationships:", relationshipError);
    return { error: "Lỗi kiểm tra mối quan hệ gia đình." };
  }

  if (relationships && relationships.length > 0) {
    return {
      error:
        "Không thể xoá. Vui lòng xoá hết các mối quan hệ gia đình của người này trước.",
    };
  }

  // 3. Delete the member
  const { error: deleteError } = await supabase
   .from("persons")
   .update({
     deleted_at: new Date().toISOString(),
     deleted_by: profile.id,
   })
   .eq("id", memberId)
   .is("deleted_at", null);

  if (deleteError) {
    console.error("Error deleting person:", deleteError);
    return { error: "Đã xảy ra lỗi khi xoá hồ sơ." };
  }

  // 4. Revalidate and redirect
  revalidatePath("/dashboard/members");
  redirect("/dashboard/members");
}
