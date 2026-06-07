import KinshipFinder from "@/components/KinshipFinder";
import { getUnifiedRelationships } from "@/compat/relationships.compat";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { filterGenealogyDataForProfile } from "@/utils/permissions/applyPersonVisibility";

export const metadata = {
  title: "Tra cứu danh xưng",
};

export default async function KinshipPage() {
  const supabase = await getSupabase();
  const profile = await getProfile();

  const { data: persons } = await supabase
    .from("persons_active")
    .select(
      "id, full_name, gender, birth_year, birth_order, generation, is_in_law, avatar_url",
    )
    .order("birth_year", { ascending: true, nullsFirst: false });

  const relationships = await getUnifiedRelationships(supabase);

  const [familiesRes, familyParentsRes, familyChildrenRes] = await Promise.all([
    supabase.from("families").select("*").is("deleted_at", null),
    supabase.from("family_parents").select("*"),
    supabase.from("family_children").select("*"),
  ]);

  const visibility = filterGenealogyDataForProfile({
    profile,
    persons: persons ?? [],
    relationships: relationships ?? [],
    families: familiesRes.data ?? [],
    familyParents: familyParentsRes.data ?? [],
    familyChildren: familyChildrenRes.data ?? [],
  });

  const isUnlinkedRestrictedUser =
    visibility.isRestricted && !visibility.viewerPersonId;

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <h1 className="title">Tra cứu danh xưng</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Chọn hai thành viên để tự động tính cách gọi theo quan hệ gia phả
        </p>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
        {isUnlinkedRestrictedUser ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            Tài khoản này chưa được gắn với người trong gia phả. Vui lòng liên hệ quản trị viên để được cấp quyền xem và tra cứu danh xưng.
          </div>
        ) : (
          <KinshipFinder
            persons={visibility.persons}
            relationships={visibility.relationships}
            restrictedNotice={
              visibility.isRestricted
                ? "Bạn chỉ tra cứu được trong nhánh gia phả được phép xem."
                : null
            }
          />
        )}
      </main>
    </div>
  );
}
