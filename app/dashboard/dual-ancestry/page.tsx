import DualAncestryPanel from "@/components/DualAncestryPanel";
import { getSupabase } from "@/utils/supabase/queries";

export const metadata = {
  title: "Họ nội / Họ ngoại",
};

export default async function DualAncestryPage() {
  const supabase = await getSupabase();

  const [
    personsRes,
    relationshipsRes,
    familiesRes,
    familyParentsRes,
    familyChildrenRes,
  ] = await Promise.all([
    supabase.from("persons_active").select("*"),
    supabase.from("relationships_active").select("*"),
    supabase.from("families").select("*").is("deleted_at", null),
    supabase.from("family_parents").select("*"),
    supabase.from("family_children").select("*"),
  ]);

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h1 className="title">Họ nội / Họ ngoại</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Xem người gốc ở giữa, nhánh cha một bên, nhánh mẹ một bên, con cháu ở phía dưới.
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
        <DualAncestryPanel
          persons={personsRes.data ?? []}
          relationships={relationshipsRes.data ?? []}
          families={familiesRes.data ?? []}
          familyParents={familyParentsRes.data ?? []}
          familyChildren={familyChildrenRes.data ?? []}
        />
      </main>
    </div>
  );
}
