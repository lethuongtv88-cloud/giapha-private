"use server";

import { Relationship } from "@/types";
import { getIsAdmin, getSupabase } from "@/utils/supabase/queries";
import { revalidatePath } from "next/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Payload shape cho file backup JSON.
 * Các field DB-managed (created_at, updated_at) được giữ để tham khảo
 * nhưng sẽ bị loại bỏ khi import lại.
 */
interface PersonExport {
  id: string;
  full_name: string;
  gender: "male" | "female" | "other";
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
  is_in_law: boolean;
  birth_order: number | null;
  generation: number | null;
  other_names: string | null;
  avatar_url: string | null;
  note: string | null;
  // DB-managed fields (kept in export for traceability, stripped on import)
  created_at?: string;
  updated_at?: string;
}

interface RelationshipExport {
  id?: string;
  type: string;
  person_a: string;
  person_b: string;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface PersonDetailsPrivateExport {
  person_id: string;
  phone_number: string | null;
  occupation: string | null;
  current_residence: string | null;
}

interface CustomEventExport {
  id: string;
  name: string;
  content: string | null;
  event_date: string;
  location: string | null;
  created_by: string | null;
}

interface BackupPayload {
  version: number;
  timestamp: string;
  persons: PersonExport[];
  relationships: RelationshipExport[];
  person_details_private?: PersonDetailsPrivateExport[];
  custom_events?: CustomEventExport[];

  // v4 export-only fields for Family/Event Model.
  // Import legacy vẫn chưa phục hồi các bảng này trực tiếp để tránh ghi đè production data.
  person_names?: unknown[];
  families?: unknown[];
  family_parents?: unknown[];
  family_children?: unknown[];
  events?: unknown[];
  person_events?: unknown[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Các field được phép insert vào bảng persons (loại bỏ created_at/updated_at)
function sanitizePerson(
  p: PersonExport,
): Omit<PersonExport, "created_at" | "updated_at"> {
  return {
    id: p.id,
    full_name: p.full_name,
    gender: p.gender,
    birth_year: p.birth_year ?? null,
    birth_month: p.birth_month ?? null,
    birth_day: p.birth_day ?? null,
    death_year: p.death_year ?? null,
    death_month: p.death_month ?? null,
    death_day: p.death_day ?? null,
    death_lunar_year: p.death_lunar_year ?? null,
    death_lunar_month: p.death_lunar_month ?? null,
    death_lunar_day: p.death_lunar_day ?? null,
    is_deceased: p.is_deceased ?? false,
    is_in_law: p.is_in_law ?? false,
    birth_order: p.birth_order ?? null,
    generation: p.generation ?? null,
    other_names: p.other_names ?? null,
    avatar_url: p.avatar_url ?? null,
    note: p.note ?? null,
  };
}

function sanitizeRelationship(
  r: RelationshipExport,
): Omit<RelationshipExport, "id" | "created_at" | "updated_at"> {
  return {
    type: r.type,
    person_a: r.person_a,
    person_b: r.person_b,
    note: r.note ?? null,
  };
}

function sanitizeCustomEvent(
  e: CustomEventExport,
): Omit<CustomEventExport, "created_by"> {
  return {
    id: e.id,
    name: e.name,
    content: e.content ?? null,
    event_date: e.event_date,
    location: e.location ?? null,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportData(
  exportRootId?: string,
): Promise<BackupPayload | { error: string }> {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) {
    return { error: "Từ chối truy cập. Chỉ admin mới có quyền này." };
  }

  const supabase = await getSupabase();

  // Fetch ALL persons and relationships first to perform traversal in memory.
  // This is safe since typical family trees are < 10,000 nodes, easily fitting in memory.
  const { data: allPersons, error: personsError } = await supabase
    .from("persons_active")
    .select(
      "id, full_name, gender, birth_year, birth_month, birth_day, death_year, death_month, death_day, death_lunar_year, death_lunar_month, death_lunar_day, is_deceased, is_in_law, birth_order, generation, other_names, avatar_url, note, created_at, updated_at",
    )
    .order("created_at", { ascending: true });

  if (personsError)
    return { error: "Lỗi tải dữ liệu persons: " + personsError.message };

  const { data: allRels, error: relationshipsError } = await supabase
    .from("relationships_active")
    .select("id, type, person_a, person_b, note, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (relationshipsError)
    return {
      error: "Lỗi tải dữ liệu relationships: " + relationshipsError.message,
    };

  const { data: allPrivateDetails, error: privateDetailsError } = await supabase
    .from("person_details_private")
    .select("person_id, phone_number, occupation, current_residence");

  if (privateDetailsError)
    return {
      error:
        "Lỗi tải dữ liệu person_details_private: " +
        privateDetailsError.message,
    };

  const { data: allCustomEvents, error: customEventsError } = await supabase
    .from("custom_events")
    .select("id, name, content, event_date, location, created_by")
    .is("deleted_at", null)
    .order("event_date", { ascending: true });

  if (customEventsError)
    return {
      error: "Lỗi tải dữ liệu custom_events: " + customEventsError.message,
    };

  const { data: allPersonNames, error: personNamesError } = await supabase
    .from("person_names")
    .select("*");

  if (personNamesError) {
    return {
      error: "Lỗi tải dữ liệu person_names: " + personNamesError.message,
    };
  }

  const { data: allFamilies, error: familiesError } = await supabase
    .from("families")
    .select("*")
    .is("deleted_at", null);

  if (familiesError) {
    return {
      error: "Lỗi tải dữ liệu families: " + familiesError.message,
    };
  }

  const { data: allFamilyParents, error: familyParentsError } = await supabase
    .from("family_parents")
    .select("*");

  if (familyParentsError) {
    return {
      error: "Lỗi tải dữ liệu family_parents: " + familyParentsError.message,
    };
  }

  const { data: allFamilyChildren, error: familyChildrenError } = await supabase
    .from("family_children")
    .select("*");

  if (familyChildrenError) {
    return {
      error: "Lỗi tải dữ liệu family_children: " + familyChildrenError.message,
    };
  }

  const { data: allEvents, error: eventsError } = await supabase
    .from("events")
    .select("*")
    .is("deleted_at", null);

  if (eventsError) {
    return {
      error: "Lỗi tải dữ liệu events: " + eventsError.message,
    };
  }

  const { data: allPersonEvents, error: personEventsError } = await supabase
    .from("person_events")
    .select("*");

  if (personEventsError) {
    return {
      error: "Lỗi tải dữ liệu person_events: " + personEventsError.message,
    };
  }

  let exportPersons = (allPersons ?? []) as PersonExport[];
  let exportRels = (allRels ?? []) as RelationshipExport[];
  let exportPrivateDetails = (allPrivateDetails ??
    []) as PersonDetailsPrivateExport[];
  const exportCustomEvents = (allCustomEvents ?? []) as CustomEventExport[];

  let exportPersonNames = allPersonNames ?? [];
  let exportFamilies = allFamilies ?? [];
  let exportFamilyParents = allFamilyParents ?? [];
  let exportFamilyChildren = allFamilyChildren ?? [];
  let exportEvents = allEvents ?? [];
  let exportPersonEvents = allPersonEvents ?? [];

  // If a root person is selected, filter the export to only their subtree
  if (exportRootId && exportPersons.some((p) => p.id === exportRootId)) {
    const includedPersonIds = new Set<string>([exportRootId]);

    // 1. Traverse biological and adopted children recursively
    const findDescendants = (parentId: string) => {
      exportRels
        .filter(
          (r) =>
            (r.type === "biological_child" || r.type === "adopted_child") &&
            r.person_a === parentId,
        )
        .forEach((r) => {
          if (!includedPersonIds.has(r.person_b)) {
            includedPersonIds.add(r.person_b);
            findDescendants(r.person_b);
          }
        });
    };
    findDescendants(exportRootId);

    // 2. Add spouses for everyone in the tree so far
    const descendantsArray = Array.from(includedPersonIds); // snapshot current members
    descendantsArray.forEach((personId) => {
      exportRels
        .filter(
          (r) =>
            r.type === "marriage" &&
            (r.person_a === personId || r.person_b === personId),
        )
        .forEach((r) => {
          const spouseId = r.person_a === personId ? r.person_b : r.person_a;
          includedPersonIds.add(spouseId);
        });
    });

    // 3. Filter the payload
    exportPersons = exportPersons.filter((p) => includedPersonIds.has(p.id));
    exportRels = exportRels.filter(
      (r) =>
        includedPersonIds.has(r.person_a) && includedPersonIds.has(r.person_b),
    );
    exportPrivateDetails = exportPrivateDetails.filter((d) =>
      includedPersonIds.has(d.person_id),
    );

    exportPersonNames = exportPersonNames.filter((name: any) =>
      includedPersonIds.has(name.person_id),
    );

    exportFamilyParents = exportFamilyParents.filter((parent: any) =>
      includedPersonIds.has(parent.person_id),
    );

    const includedFamilyIds = new Set(
      exportFamilyParents.map((parent: any) => parent.family_id),
    );

    exportFamilyChildren = exportFamilyChildren.filter((child: any) => {
      const keep =
        includedPersonIds.has(child.person_id) &&
        includedFamilyIds.has(child.family_id);

      if (keep) includedFamilyIds.add(child.family_id);
      return keep;
    });

    exportFamilies = exportFamilies.filter((family: any) =>
      includedFamilyIds.has(family.id),
    );

    exportEvents = exportEvents.filter((event: any) => {
      if (
        event.legacy_person_id &&
        includedPersonIds.has(event.legacy_person_id)
      ) {
        return true;
      }

      if (event.family_id && includedFamilyIds.has(event.family_id)) {
        return true;
      }

      return false;
    });

    const includedEventIds = new Set(exportEvents.map((event: any) => event.id));

    exportPersonEvents = exportPersonEvents.filter((personEvent: any) => {
      return (
        includedPersonIds.has(personEvent.person_id) &&
        includedEventIds.has(personEvent.event_id)
      );
    });

    // custom_events are not person-scoped, so export all when subtree is selected
  }

  return {
    version: 4, // v4: adds Family/Event Model export fields, still imports legacy-safe payload only
    timestamp: new Date().toISOString(),
    persons: exportPersons,
    relationships: exportRels,
    person_details_private: exportPrivateDetails,
    custom_events: exportCustomEvents,
    person_names: exportPersonNames,
    families: exportFamilies,
    family_parents: exportFamilyParents,
    family_children: exportFamilyChildren,
    events: exportEvents,
    person_events: exportPersonEvents,
  };
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importData(
  importPayload:
    | BackupPayload
    | {
        persons: PersonExport[];
        relationships: Relationship[];
        person_details_private?: PersonDetailsPrivateExport[];
        custom_events?: CustomEventExport[];
      },
) {
  void importPayload;

  return {
    success: false,
    error:
      "Chức năng import/restore JSON legacy đã được khóa tạm thời để tránh xóa nhầm dữ liệu. Vui lòng dùng Backup Database để restore an toàn.",
  };
}
