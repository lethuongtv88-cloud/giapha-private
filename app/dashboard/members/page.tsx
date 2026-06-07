import { MemberListProvider } from "@/context/MemberListContext";
import MembersViews from "@/components/MembersViews";
import MemberDetailModal from "@/components/modal/MemberDetailModal";
import ViewToggle from "@/components/ViewToggle";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { hydratePersonsWithDateEvents } from "@/compat/dateHydration.compat";
import { ViewMode } from "@/components/ViewToggle";
import {
  filterGenealogyDataForProfile,
  resolvePermittedRootId,
} from "@/utils/permissions/applyPersonVisibility";

interface PageProps {
  searchParams: Promise<{ view?: string; rootId?: string; avatar?: string }>;
}

function PermissionEmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-xl rounded-2xl border border-amber-200/70 bg-amber-50/80 p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-stone-800">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{message}</p>
      </div>
    </div>
  );
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
  const relationshipsAll = relsRes.data || [];
  const familiesAll = familiesRes.data || [];
  const familyParentsAll = familyParentsRes.data || [];
  const familyChildrenAll = familyChildrenRes.data || [];

  const permissionFiltered = filterGenealogyDataForProfile({
    profile,
    persons: rawPersons,
    relationships: relationshipsAll,
    families: familiesAll,
    familyParents: familyParentsAll,
    familyChildren: familyChildrenAll,
  });

  if (
    permissionFiltered.isRestricted &&
    !permissionFiltered.viewerPersonId
  ) {
    return (
      <PermissionEmptyState
        title="Tài khoản chưa được gắn với người trong gia phả"
        message="Vui lòng liên hệ quản trị viên để gắn tài khoản của bạn với một hồ sơ thành viên. Sau đó bạn sẽ xem được nhánh nội ngoại và sui gia trực tiếp của mình."
      />
    );
  }

  if (
    permissionFiltered.isRestricted &&
    permissionFiltered.visiblePersonIds.size === 0
  ) {
    return (
      <PermissionEmptyState
        title="Không có dữ liệu được phép xem"
        message={
          permissionFiltered.warnings[0] ||
          "Tài khoản của bạn chưa có phạm vi gia phả hợp lệ để hiển thị."
        }
      />
    );
  }

  const persons = await hydratePersonsWithDateEvents(
    supabase,
    permissionFiltered.persons,
  );
  const relationships = permissionFiltered.relationships;
  const families = permissionFiltered.families;
  const familyParents = permissionFiltered.familyParents;
  const familyChildren = permissionFiltered.familyChildren;

  const personsMap = new Map();
  persons.forEach((p) => personsMap.set(p.id, p));

  const childIds = new Set(
    relationships
      .filter(
        (r) => r.type === "biological_child" || r.type === "adopted_child",
      )
      .map((r) => r.person_b),
  );

  let finalRootId = permissionFiltered.isRestricted
    ? resolvePermittedRootId({
        requestedRootId: rootId,
        fallbackRootId: permissionFiltered.viewerPersonId,
        visiblePersonIds: permissionFiltered.visiblePersonIds,
        persons,
      })
    : rootId;

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
        allowedPersonIds={
          permissionFiltered.isRestricted
            ? Array.from(permissionFiltered.visiblePersonIds)
            : null
        }
      />

      <MemberDetailModal />
    </MemberListProvider>
  );
}
