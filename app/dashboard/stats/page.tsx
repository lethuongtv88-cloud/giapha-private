import FamilyStats from "@/components/FamilyStats";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { filterGenealogyDataForProfile } from "@/utils/permissions/applyPersonVisibility";

export const metadata = {
  title: "Thống kê gia phả",
};

export default async function StatsPage() {
  const supabase = await getSupabase();
  const profile = await getProfile();

  const [
    personsRes,
    relationshipsRes,
    familiesRes,
    familyParentsRes,
    familyChildrenRes,
    eventsRes,
  ] = await Promise.all([
    supabase.from("persons_active").select("*"),
    supabase.from("relationships_active").select("*"),
    supabase.from("families").select("*").is("deleted_at", null),
    supabase.from("family_parents").select("*"),
    supabase.from("family_children").select("*"),
    supabase.from("events").select("*").is("deleted_at", null),
  ]);

  const visibility = filterGenealogyDataForProfile({
    profile,
    persons: personsRes.data ?? [],
    relationships: relationshipsRes.data ?? [],
    families: familiesRes.data ?? [],
    familyParents: familyParentsRes.data ?? [],
    familyChildren: familyChildrenRes.data ?? [],
  });

  const isUnlinkedRestrictedUser =
    visibility.isRestricted && !visibility.viewerPersonId;

  const visibleEvents = visibility.isRestricted
    ? (eventsRes.data ?? []).filter((event: any) => {
        const personId = event.legacy_person_id ?? event.person_id ?? null;
        return personId ? visibility.visiblePersonIds.has(personId) : false;
      })
    : eventsRes.data ?? [];

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <h1 className="title">Thống kê gia phả</h1>
        <p className="text-stone-500 mt-1 text-sm">
          {visibility.isRestricted
            ? "Thống kê nhánh gia phả bạn được phép xem"
            : "Tổng quan số liệu về các thành viên trong dòng họ"}
        </p>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
        {isUnlinkedRestrictedUser ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            Tài khoản này chưa được gắn với người trong gia phả. Vui lòng liên hệ quản trị viên để được cấp quyền xem thống kê.
          </div>
        ) : (
          <FamilyStats
            persons={visibility.persons}
            relationships={visibility.relationships}
            families={visibility.families}
            familyParents={visibility.familyParents}
            familyChildren={visibility.familyChildren}
            events={visibleEvents}
            restrictedMode={visibility.isRestricted}
            fallbackRootId={visibility.viewerPersonId}
          />
        )}
      </main>
    </div>
  );
}