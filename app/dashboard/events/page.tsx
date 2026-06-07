import { MemberListProvider } from "@/context/MemberListContext";
import EventsList from "@/components/EventsList";
import MemberDetailModal from "@/components/modal/MemberDetailModal";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import {
  buildVisiblePersonSetForProfile,
  filterPersonEventsForVisiblePersons,
} from "@/utils/permissions/applyPersonVisibility";

export const metadata = {
  title: "Sự kiện gia phả",
};

type EventPerson = {
  id: string;
  full_name: string;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  death_lunar_year: number | null;
  death_lunar_month: number | null;
  death_lunar_day: number | null;
  is_deceased: boolean;
  avatar_url?: string | null;
};

type CustomEvent = {
  id: string;
  name: string;
  content: string | null;
  event_date: string;
  location: string | null;
  created_by: string | null;
};

type PermissionRelationship = {
  id?: string;
  type?: string | null;
  person_a?: string | null;
  person_b?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
};

type PermissionFamily = {
  id: string;
  [key: string]: unknown;
};

type PermissionFamilyParent = {
  family_id: string;
  person_id: string;
  [key: string]: unknown;
};

type PermissionFamilyChild = {
  family_id: string;
  person_id: string;
  [key: string]: unknown;
};

type PermissionEvent = {
  id: string;
  legacy_person_id?: string | null;
  family_id?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
};

type PermissionPersonEvent = {
  person_id: string;
  event_id: string;
  [key: string]: unknown;
};

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

export default async function EventsPage() {
  const supabase = await getSupabase();
  const profile = await getProfile();

  const [
    personsRes,
    customEventsRes,
    relationshipsRes,
    familiesRes,
    familyParentsRes,
    familyChildrenRes,
    eventsRes,
    personEventsRes,
  ] = await Promise.all([
    supabase
      .from("persons_active")
      .select(
        "id, full_name, birth_year, birth_month, birth_day, death_year, death_month, death_day, death_lunar_year, death_lunar_month, death_lunar_day, is_deceased, avatar_url",
      ),
    supabase
      .from("custom_events")
      .select("id, name, content, event_date, location, created_by"),
    supabase.from("relationships_active").select("*"),
    supabase.from("families").select("*").is("deleted_at", null),
    supabase.from("family_parents").select("*"),
    supabase.from("family_children").select("*"),
    supabase.from("events").select("*").is("deleted_at", null),
    supabase.from("person_events").select("*"),
  ]);

  const allPersons = (personsRes.data ?? []) as EventPerson[];
  const allCustomEvents = (customEventsRes.data ?? []) as CustomEvent[];
  const allRelationships = (relationshipsRes.data ?? []) as PermissionRelationship[];
  const allFamilies = (familiesRes.data ?? []) as PermissionFamily[];
  const allFamilyParents = (familyParentsRes.data ?? []) as PermissionFamilyParent[];
  const allFamilyChildren = (familyChildrenRes.data ?? []) as PermissionFamilyChild[];
  const allEvents = (eventsRes.data ?? []) as PermissionEvent[];
  const allPersonEvents = (personEventsRes.data ?? []) as PermissionPersonEvent[];

  const permission = buildVisiblePersonSetForProfile({
    profile,
    persons: allPersons,
    relationships: allRelationships,
    families: allFamilies,
    familyParents: allFamilyParents,
    familyChildren: allFamilyChildren,
  });

  if (permission.isRestricted && !permission.viewerPersonId) {
    return (
      <PermissionEmptyState
        title="Tài khoản chưa được gắn với người trong gia phả"
        message="Vui lòng liên hệ quản trị viên để gắn tài khoản của bạn với một hồ sơ thành viên. Sau đó bạn sẽ xem được sự kiện thuộc nhánh được phép."
      />
    );
  }

  if (permission.isRestricted && permission.visiblePersonIds.size === 0) {
    return (
      <PermissionEmptyState
        title="Không có sự kiện được phép xem"
        message={
          permission.warnings[0] ||
          "Tài khoản của bạn chưa có phạm vi gia phả hợp lệ để hiển thị sự kiện."
        }
      />
    );
  }

  const visibleFamilyIds = permission.isRestricted
    ? new Set(
        allFamilies
          .filter((family) => {
            const parents = allFamilyParents.filter(
              (row) => row.family_id === family.id,
            );
            const children = allFamilyChildren.filter(
              (row) => row.family_id === family.id,
            );

            return (
              parents.some((row) =>
                permission.visiblePersonIds.has(row.person_id),
              ) ||
              children.some((row) =>
                permission.visiblePersonIds.has(row.person_id),
              )
            );
          })
          .map((family) => family.id),
      )
    : new Set(allFamilies.map((family) => family.id));

  if (permission.isRestricted) {
    filterPersonEventsForVisiblePersons({
      events: allEvents,
      personEvents: allPersonEvents,
      visiblePersonIds: permission.visiblePersonIds,
      visibleFamilyIds,
    });
  }

  const persons = permission.isRestricted
    ? allPersons.filter((person) => permission.visiblePersonIds.has(person.id))
    : allPersons;

  // custom_events hiện là sự kiện chung, chưa có liên kết person_events.
  // Vì vậy user thường không thấy custom_events để tránh rò rỉ sự kiện ngoài nhánh.
  const customEvents = permission.isRestricted ? [] : allCustomEvents;

  return (
    <MemberListProvider>
      <div className="flex-1 w-full relative flex flex-col pb-12">
        <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
          <h1 className="title">Sự kiện gia phả</h1>
          <p className="text-stone-500 mt-1 text-sm">
            Sinh nhật, ngày giỗ (âm lịch) và các sự kiện tuỳ chỉnh
          </p>
          {permission.isRestricted ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800">
              Bạn đang xem các sự kiện thuộc nhánh gia phả được phép. Sự kiện
              của người ngoài nhánh và sự kiện chung chưa gắn người sẽ không
              hiển thị.
            </p>
          ) : null}
        </div>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
          <EventsList persons={persons} customEvents={customEvents} />
        </main>
      </div>

      <MemberDetailModal />
    </MemberListProvider>
  );
}