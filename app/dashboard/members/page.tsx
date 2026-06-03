import { MemberListProvider } from "@/context/MemberListContext";
import MembersViews from "@/components/MembersViews";
import MemberDetailModal from "@/components/modal/MemberDetailModal";
import ViewToggle from "@/components/ViewToggle";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { hydratePersonsWithDateEvents } from "@/compat/dateHydration.compat";
import { ViewMode } from "@/components/ViewToggle";

interface PageProps {
  searchParams: Promise<{ view?: string; rootId?: string; avatar?: string }>;
}

export default async function FamilyTreePage({ searchParams }: PageProps) {
  const { view, rootId, avatar } = await searchParams;
  const initialView = view as ViewMode | undefined;
  const initialShowAvatar = avatar !== "hide";

  const profile = await getProfile();
  const canEdit = profile?.role === "admin" || profile?.role === "editor";

  const supabase = await getSupabase();

  const [
    personsRes,
    relsRes,
    familiesRes,
    familyParentsRes,
    familyChildrenRes,
  ] = await Promise.all([
    supabase
      .from("persons_active")
      .select("*")
      .order("birth_year", { ascending: true, nullsFirst: false }),

    supabase.from("relationships_active").select("*"),

    supabase
      .from("families")
      .select("*")
      .is("deleted_at", null)
      .order("start_year", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true, nullsFirst: false }),

    supabase
      .from("family_parents")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false }),

    supabase
      .from("family_children")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false }),
  ]);

  const rawPersons = personsRes.data || [];
  const persons = await hydratePersonsWithDateEvents(supabase, rawPersons);
  const relationships = relsRes.data || [];

  const families = familiesRes.data || [];
  const familyParents = familyParentsRes.data || [];
  const familyChildren = familyChildrenRes.data || [];

  const personsMap = new Map();
  persons.forEach((p) => personsMap.set(p.id, p));

  const childIds = new Set(
    relationships
      .filter(
        (r) => r.type === "biological_child" || r.type === "adopted_child",
      )
      .map((r) => r.person_b),
  );

  let finalRootId = rootId;

  if (!finalRootId || !personsMap.has(finalRootId)) {
    const rootsFallback = persons.filter((p) => !childIds.has(p.id));

    if (rootsFallback.length > 0) {
      finalRootId = rootsFallback[0].id;
    } else if (persons.length > 0) {
      finalRootId = persons[0].id;
    }
  }

  return (
    <MemberListProvider
      initialView={initialView}
      initialRootId={finalRootId}
      initialShowAvatar={initialShowAvatar}
    >
      <ViewToggle />

      <MembersViews
        persons={persons}
        relationships={relationships}
        families={families}
        familyParents={familyParents}
        familyChildren={familyChildren}
        canEdit={canEdit}
      />

      <MemberDetailModal />
    </MemberListProvider>
  );
}
