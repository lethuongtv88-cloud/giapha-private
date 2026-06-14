import EventsList from "@/components/EventsList";
import type { Person } from "@/types";
import MemberDetailModal from "@/components/modal/MemberDetailModal";
import { MemberListProvider } from "@/context/MemberListContext";
import {
  buildVisiblePersonSetForProfile,
  filterPersonEventsForVisiblePersons,
} from "@/utils/permissions/applyPersonVisibility";
import { getProfile, getSupabase } from "@/utils/supabase/queries";

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
  gender?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_in_law?: boolean | null;
  birth_order?: number | null;
  generation?: number | null;
  other_names?: string | null;
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
  type?: string | null;
  title?: string | null;
  description?: string | null;
  place_text?: string | null;
  place_id?: string | null;
  legacy_source?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  sort_date?: string | null;
  date_precision?: string | null;
  legacy_person_id?: string | null;
  family_id?: string | null;
  deleted_at?: string | null;
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  [key: string]: unknown;
};

type PermissionPersonEvent = {
  person_id: string;
  event_id: string;
  role?: string | null;
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

function toPersonSelectorRows(persons: EventPerson[]) {
  return persons.map((person) => ({
    id: person.id,
    full_name: person.full_name,
    gender: person.gender === "female" || person.gender === "male" ? person.gender : "other",
    birth_year: person.birth_year ?? null,
    birth_month: person.birth_month ?? null,
    birth_day: person.birth_day ?? null,
    death_year: person.death_year ?? null,
    death_month: person.death_month ?? null,
    death_day: person.death_day ?? null,
    avatar_url: person.avatar_url ?? null,
    note: person.note ?? null,
    created_at: person.created_at ?? "",
    updated_at: person.updated_at ?? "",
    death_lunar_year: person.death_lunar_year ?? null,
    death_lunar_month: person.death_lunar_month ?? null,
    death_lunar_day: person.death_lunar_day ?? null,
    is_deceased: person.is_deceased ?? false,
    is_in_law: person.is_in_law ?? false,
    birth_order: person.birth_order ?? null,
    generation: person.generation ?? null,
    other_names: person.other_names ?? null,
  })) as Person[];
}

function isFutureEvent(event: PermissionEvent) {
  const raw = event.start_date || event.sort_date;
  if (!raw || event.date_precision !== "day") return false;
  const eventDate = new Date(`${String(raw).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return eventDate.getTime() >= today.getTime();
}

function isDirectMarriageViewer(input: {
  event: PermissionEvent;
  personEvents: PermissionPersonEvent[];
  familyChildren: PermissionFamilyChild[];
  viewerPersonId: string | null;
}) {
  if (!input.viewerPersonId) return false;

  const principalIds = input.personEvents
    .filter((row) => row.event_id === input.event.id)
    .filter((row) => row.role !== "visibility_root")
    .map((row) => row.person_id);

  if (principalIds.includes(input.viewerPersonId)) return true;

  if (input.event.family_id) {
    return input.familyChildren.some(
      (row) =>
        row.family_id === input.event.family_id &&
        row.person_id === input.viewerPersonId,
    );
  }

  return false;
}

function filterEventsForEventList(input: {
  events: PermissionEvent[];
  personEvents: PermissionPersonEvent[];
  familyChildren: PermissionFamilyChild[];
  isRestricted: boolean;
  viewerPersonId: string | null;
}) {
  return input.events.filter((event) => {
    if (event.type !== "marriage") return true;

    // Đám cưới sắp tới: hiển thị 1 lần theo quyền xem hiện có.
    if (isFutureEvent(event)) return true;

    // Kỷ niệm cưới: chỉ cho vợ/chồng hoặc con trực tiếp của cặp đó xem.
    if (!input.isRestricted) return true;

    return isDirectMarriageViewer({
      event,
      personEvents: input.personEvents,
      familyChildren: input.familyChildren,
      viewerPersonId: input.viewerPersonId,
    });
  });
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
        "id, full_name, gender, birth_year, birth_month, birth_day, death_year, death_month, death_day, death_lunar_year, death_lunar_month, death_lunar_day, is_deceased, is_in_law, birth_order, generation, other_names, avatar_url, note, created_at, updated_at",
      ),
    supabase
      .from("custom_events")
      .select("id, name, content, event_date, location, created_by")
      .is("deleted_at", null),
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

  const eventFilter = permission.isRestricted
    ? filterPersonEventsForVisiblePersons({
        events: allEvents,
        personEvents: allPersonEvents,
        visiblePersonIds: permission.visiblePersonIds,
        visibleFamilyIds,
      })
    : { events: allEvents, personEvents: allPersonEvents };

  const persons = permission.isRestricted
    ? allPersons.filter((person) => permission.visiblePersonIds.has(person.id))
    : allPersons;

  const customEvents = permission.isRestricted ? [] : allCustomEvents;
  const canCreateEvent = profile?.role === "admin" || profile?.role === "editor";
  const selectorPersons = toPersonSelectorRows(persons);
  const eventsForList = filterEventsForEventList({
    // Ngày mất là dữ liệu lịch sử trong timeline hồ sơ người.
    // Trang Events chỉ dùng các sự kiện cần nhắc; ngày giỗ dùng death_anniversary.
    events: eventFilter.events.filter((event) => event.type !== "death"),
    personEvents: eventFilter.personEvents,
    familyChildren: allFamilyChildren,
    isRestricted: permission.isRestricted,
    viewerPersonId: permission.viewerPersonId,
  });

  return (
    <MemberListProvider>
      <div className="flex-1 w-full relative flex flex-col pb-12">
        <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <h1 className="title">Sự kiện gia phả</h1>
          <p className="text-stone-500 mt-1 text-sm">
            Sinh nhật, ngày giỗ, kỷ niệm ngày cưới, đám cưới và các sự kiện gia đình
          </p>
          {permission.isRestricted ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800">
              Bạn đang xem các sự kiện thuộc nhánh gia phả được phép. Sự kiện
              của người ngoài nhánh và sự kiện chung chưa gắn người sẽ không
              hiển thị.
            </p>
          ) : null}
        </div>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-8">
          <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
            <EventsList
              persons={persons}
              customEvents={customEvents}
              eventModelEvents={eventsForList}
              personEvents={eventFilter.personEvents}
              selectorPersons={selectorPersons}
              canCreateEvent={canCreateEvent}
            />
          </section>
        </main>
      </div>

      <MemberDetailModal />
    </MemberListProvider>
  );
}
