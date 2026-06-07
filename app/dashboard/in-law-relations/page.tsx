import InLawRelationsPanel from "@/components/InLawRelationsPanel";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { filterGenealogyDataForProfile } from "@/utils/permissions/applyPersonVisibility";

export const metadata = {
  title: "Sui gia",
};

function PermissionEmptyState({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
      <p className="font-semibold">Tài khoản chưa được cấp phạm vi xem gia phả.</p>
      <div className="mt-2 space-y-1 text-amber-800">
        {warnings.length > 0 ? (
          warnings.map((warning) => <p key={warning}>• {warning}</p>)
        ) : (
          <p>Vui lòng liên hệ quản trị viên để gắn tài khoản với một người trong gia phả.</p>
        )}
      </div>
    </div>
  );
}

export default async function InLawRelationsPage() {
  const supabase = await getSupabase();
  const profile = await getProfile();

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

  const visibility = filterGenealogyDataForProfile({
    profile,
    persons: personsRes.data ?? [],
    relationships: relationshipsRes.data ?? [],
    families: familiesRes.data ?? [],
    familyParents: familyParentsRes.data ?? [],
    familyChildren: familyChildrenRes.data ?? [],
  });

  const isBlocked = visibility.isRestricted && !visibility.viewerPersonId;

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h1 className="title">Sui gia</h1>
        <p className="text-stone-500 mt-1 text-sm">
          So tương quan thế hệ nội ngoại bên người gốc và bên vợ/chồng để tiện xác định vai vế, cách xưng hô.
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
        {isBlocked ? (
          <PermissionEmptyState warnings={visibility.warnings} />
        ) : (
          <InLawRelationsPanel
            persons={visibility.persons}
            relationships={visibility.relationships}
            families={visibility.families}
            familyParents={visibility.familyParents}
            familyChildren={visibility.familyChildren}
            isRestricted={visibility.isRestricted}
            viewerPersonId={visibility.viewerPersonId}
            permissionWarnings={visibility.warnings}
          />
        )}
      </main>
    </div>
  );
}
