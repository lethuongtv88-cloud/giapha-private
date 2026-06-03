import FamilyStats from "@/components/FamilyStats";
import { getSupabase } from "@/utils/supabase/queries";

export const metadata = {
  title: "Thống kê gia phả",
};

export default async function StatsPage() {
  const supabase = await getSupabase();

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

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <h1 className="title">Thống kê gia phả</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Tổng quan số liệu về các thành viên trong dòng họ
        </p>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
        <FamilyStats
          persons={personsRes.data ?? []}
          relationships={relationshipsRes.data ?? []}
          families={familiesRes.data ?? []}
          familyParents={familyParentsRes.data ?? []}
          familyChildren={familyChildrenRes.data ?? []}
          events={eventsRes.data ?? []}
        />
      </main>
    </div>
  );
}