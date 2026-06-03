import { parseGedcom } from "@/utils/gedcom";

export type ImportRecordType =
  | "person"
  | "name"
  | "family"
  | "family_parent"
  | "family_child"
  | "event"
  | "person_event"
  | "note"
  | "source"
  | "media"
  | "warning"
  | "unknown";

export interface ImportStagingRecordDraft {
  record_type: ImportRecordType;
  external_id?: string | null;
  parent_external_id?: string | null;
  action: "create" | "update" | "match" | "skip" | "warning" | "error";
  confidence: "certain" | "review" | "low" | "manual";
  status: "pending" | "approved" | "skipped" | "rejected" | "committed";
  payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  sort_order: number;
}

export interface GedcomStagingPreview {
  summary: {
    persons: number;
    names: number;
    families: number;
    familyParents: number;
    familyChildren: number;
    events: number;
    personEvents: number;
    warnings: number;
    errors: number;
  };
  records: ImportStagingRecordDraft[];
  warnings: string[];
  errors: string[];
}

interface ParsedGedcomLike {
  persons?: Array<Record<string, any>>;
  relationships?: Array<Record<string, any>>;
  warnings?: string[];
}

export function buildGedcomStagingPreview(content: string): GedcomStagingPreview {
  const warnings: string[] = [];
  const errors: string[] = [];
  const records: ImportStagingRecordDraft[] = [];

  let parsed: ParsedGedcomLike;

  try {
    parsed = parseGedcom(content) as ParsedGedcomLike;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    return {
      summary: emptySummary(0, 1),
      records: [
        {
          record_type: "warning",
          external_id: null,
          parent_external_id: null,
          action: "error",
          confidence: "manual",
          status: "pending",
          payload: { message },
          normalized_payload: {},
          warnings: [],
          errors: [message],
          sort_order: 0,
        },
      ],
      warnings: [],
      errors: [message],
    };
  }

  for (const warning of parsed.warnings ?? []) {
    warnings.push(warning);
    records.push({
      record_type: "warning",
      external_id: null,
      parent_external_id: null,
      action: "warning",
      confidence: "manual",
      status: "pending",
      payload: { message: warning },
      normalized_payload: {},
      warnings: [warning],
      errors: [],
      sort_order: records.length,
    });
  }

  const personIdMap = new Map<string, string>();

  for (const person of parsed.persons ?? []) {
    const externalId = String(person.id ?? person.external_id ?? `person_${records.length + 1}`);
    personIdMap.set(externalId, externalId);

    const fullName = getGedcomPersonFullName(person);
    const surname = getGedcomPersonSurname(person);
    const givenName = getGedcomPersonGivenName(person);

    records.push({
      record_type: "person",
      external_id: externalId,
      parent_external_id: null,
      action: "create",
      confidence: fullName === "Chưa rõ tên" ? "review" : "certain",
      status: "pending",
      payload: person,
      normalized_payload: {
        external_id: externalId,
        full_name: fullName,
        gender: normalizeGender(person.gender),
        birth_year: person.birth_year ?? null,
        birth_month: person.birth_month ?? null,
        birth_day: person.birth_day ?? null,
        death_year: person.death_year ?? null,
        death_month: person.death_month ?? null,
        death_day: person.death_day ?? null,
        is_deceased: Boolean(person.is_deceased || person.death_year),
        note: person.note ?? null,
      },
      warnings: fullName === "Chưa rõ tên" ? ["Person chưa có tên rõ ràng."] : [],
      errors: [],
      sort_order: records.length,
    });

    records.push({
      record_type: "name",
      external_id: `${externalId}:primary_name`,
      parent_external_id: externalId,
      action: "create",
      confidence: fullName === "Chưa rõ tên" ? "review" : "certain",
      status: "pending",
      payload: {
        person_external_id: externalId,
        full_name: fullName,
        surname,
        given_name: givenName,
      },
      normalized_payload: {
        person_external_id: externalId,
        full_name: fullName,
        surname,
        given_name: givenName,
        is_primary: true,
        name_type: "birth",
        language: "vi",
      },
      warnings: [],
      errors: [],
      sort_order: records.length,
    });

    if (person.birth_year) {
      const eventExternalId = `${externalId}:birth`;

      records.push({
        record_type: "event",
        external_id: eventExternalId,
        parent_external_id: externalId,
        action: "create",
        confidence: "certain",
        status: "pending",
        payload: person,
        normalized_payload: {
          type: "birth",
          legacy_person_external_id: externalId,
          start_date: toIsoDateRange(
            Number(person.birth_year),
            person.birth_month ? Number(person.birth_month) : null,
            person.birth_day ? Number(person.birth_day) : null,
          ).start_date,
          end_date: toIsoDateRange(
            Number(person.birth_year),
            person.birth_month ? Number(person.birth_month) : null,
            person.birth_day ? Number(person.birth_day) : null,
          ).end_date,
          sort_date: toIsoDateRange(
            Number(person.birth_year),
            person.birth_month ? Number(person.birth_month) : null,
            person.birth_day ? Number(person.birth_day) : null,
          ).sort_date,
          date_precision: getDatePrecision(person.birth_month, person.birth_day),
          legacy_source: "gedcom.birth",
        },
        warnings: [],
        errors: [],
        sort_order: records.length,
      });

      records.push({
        record_type: "person_event",
        external_id: `${eventExternalId}:person_event`,
        parent_external_id: eventExternalId,
        action: "create",
        confidence: "certain",
        status: "pending",
        payload: {},
        normalized_payload: {
          person_external_id: externalId,
          event_external_id: eventExternalId,
          role: "principal",
        },
        warnings: [],
        errors: [],
        sort_order: records.length,
      });
    }

    if (person.death_year || person.is_deceased) {
      const eventExternalId = `${externalId}:death`;

      records.push({
        record_type: "event",
        external_id: eventExternalId,
        parent_external_id: externalId,
        action: person.death_year ? "create" : "skip",
        confidence: person.death_year ? "certain" : "review",
        status: person.death_year ? "pending" : "skipped",
        payload: person,
        normalized_payload: person.death_year
          ? {
              type: "death",
              legacy_person_external_id: externalId,
              start_date: toIsoDateRange(
                Number(person.death_year),
                person.death_month ? Number(person.death_month) : null,
                person.death_day ? Number(person.death_day) : null,
              ).start_date,
              end_date: toIsoDateRange(
                Number(person.death_year),
                person.death_month ? Number(person.death_month) : null,
                person.death_day ? Number(person.death_day) : null,
              ).end_date,
              sort_date: toIsoDateRange(
                Number(person.death_year),
                person.death_month ? Number(person.death_month) : null,
                person.death_day ? Number(person.death_day) : null,
              ).sort_date,
              date_precision: getDatePrecision(person.death_month, person.death_day),
              lunar_year: person.death_lunar_year ?? null,
              lunar_month: person.death_lunar_month ?? null,
              lunar_day: person.death_lunar_day ?? null,
              lunar_is_leap_month: person.death_lunar_is_leap ?? false,
              legacy_source: "gedcom.death",
            }
          : {
              type: "death",
              legacy_person_external_id: externalId,
              legacy_source: "gedcom.death_no_date",
            },
        warnings: person.death_year
          ? []
          : ["Person có DEAT Y nhưng không có ngày mất. Sẽ không tạo death event có date."],
        errors: [],
        sort_order: records.length,
      });

      if (person.death_year) {
        records.push({
          record_type: "person_event",
          external_id: `${eventExternalId}:person_event`,
          parent_external_id: eventExternalId,
          action: "create",
          confidence: "certain",
          status: "pending",
          payload: {},
          normalized_payload: {
            person_external_id: externalId,
            event_external_id: eventExternalId,
            role: "deceased",
          },
          warnings: [],
          errors: [],
          sort_order: records.length,
        });
      }
    }
  }

  const familyMap = new Map<string, string>();

  for (const rel of parsed.relationships ?? []) {
    if (rel.type === "marriage") {
      const a = rel.person_a ?? rel.husband_id ?? rel.person1_id;
      const b = rel.person_b ?? rel.wife_id ?? rel.person2_id;

      if (!a || !b) {
        warnings.push("GEDCOM marriage thiếu spouse id.");
        continue;
      }

      const familyExternalId = String(rel.family_id ?? rel.id ?? `family_${records.length + 1}`);
      familyMap.set(familyExternalId, familyExternalId);

      records.push({
        record_type: "family",
        external_id: familyExternalId,
        parent_external_id: null,
        action: "create",
        confidence: "review",
        status: "pending",
        payload: rel,
        normalized_payload: {
          external_id: familyExternalId,
          status: rel.status ?? "active",
        },
        warnings: [],
        errors: [],
        sort_order: records.length,
      });

      records.push({
        record_type: "family_parent",
        external_id: `${familyExternalId}:${a}:parent`,
        parent_external_id: familyExternalId,
        action: "create",
        confidence: "review",
        status: "pending",
        payload: rel,
        normalized_payload: {
          family_external_id: familyExternalId,
          person_external_id: String(a),
          role: "husband",
          sort_order: 1,
        },
        warnings: [],
        errors: [],
        sort_order: records.length,
      });

      records.push({
        record_type: "family_parent",
        external_id: `${familyExternalId}:${b}:parent`,
        parent_external_id: familyExternalId,
        action: "create",
        confidence: "review",
        status: "pending",
        payload: rel,
        normalized_payload: {
          family_external_id: familyExternalId,
          person_external_id: String(b),
          role: "wife",
          sort_order: 2,
        },
        warnings: [],
        errors: [],
        sort_order: records.length,
      });
    }
  }

  for (const rel of parsed.relationships ?? []) {
    if (rel.type !== "biological_child" && rel.type !== "adopted_child") continue;

    const parentId = rel.person_a ?? rel.parent_id;
    const childId = rel.person_b ?? rel.child_id;

    if (!parentId || !childId) {
      warnings.push("GEDCOM child relationship thiếu parent/child id.");
      continue;
    }

    const familyExternalId =
      String(rel.family_id ?? rel.parent_family_id ?? findFamilyForParent(records, String(parentId)));

    records.push({
      record_type: "family_child",
      external_id: `${familyExternalId}:${childId}:child`,
      parent_external_id: familyExternalId,
      action: "create",
      confidence: familyExternalId ? "review" : "low",
      status: familyExternalId ? "pending" : "pending",
      payload: rel,
      normalized_payload: {
        family_external_id: familyExternalId,
        person_external_id: String(childId),
        relationship_type: rel.type === "adopted_child" ? "adopted" : "biological",
      },
      warnings: familyExternalId ? [] : ["Không xác định được family cho child relationship."],
      errors: [],
      sort_order: records.length,
    });
  }

  const recordWarnings = records.reduce((sum, record) => sum + record.warnings.length, 0);
  const recordErrors = records.reduce((sum, record) => sum + record.errors.length, 0);

  return {
    summary: {
      persons: records.filter((r) => r.record_type === "person").length,
      names: records.filter((r) => r.record_type === "name").length,
      families: records.filter((r) => r.record_type === "family").length,
      familyParents: records.filter((r) => r.record_type === "family_parent").length,
      familyChildren: records.filter((r) => r.record_type === "family_child").length,
      events: records.filter((r) => r.record_type === "event").length,
      personEvents: records.filter((r) => r.record_type === "person_event").length,
      warnings: warnings.length + recordWarnings,
      errors: errors.length + recordErrors,
    },
    records,
    warnings,
    errors,
  };
}

function getGedcomPersonFullName(person: Record<string, any>): string {
  const candidates = [
    person.full_name,
    person.fullName,
    person.name,
    person.gedcom_name,
    person.display_name,
    person.full_text,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim() && value.trim() !== "Unknown") {
      return value.trim();
    }
  }

  if (Array.isArray(person.names)) {
    for (const name of person.names) {
      const value =
        name?.full_name ??
        name?.fullName ??
        name?.full_text ??
        name?.name ??
        null;

      if (typeof value === "string" && value.trim() && value.trim() !== "Unknown") {
        return value.trim();
      }
    }
  }

  return "Chưa rõ tên";
}

function getGedcomPersonSurname(person: Record<string, any>): string | null {
  const value = person.surname ?? person.last_name ?? person.family_name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getGedcomPersonGivenName(person: Record<string, any>): string | null {
  const value = person.given_name ?? person.givenName ?? person.first_name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function emptySummary(warnings: number, errors: number) {
  return {
    persons: 0,
    names: 0,
    families: 0,
    familyParents: 0,
    familyChildren: 0,
    events: 0,
    personEvents: 0,
    warnings,
    errors,
  };
}

function normalizeGender(input: unknown): "male" | "female" | "other" | null {
  if (input === "M" || input === "male") return "male";
  if (input === "F" || input === "female") return "female";
  if (input === "other") return "other";
  return null;
}

function getDatePrecision(month?: unknown, day?: unknown): "year" | "month" | "day" {
  if (month && day) return "day";
  if (month) return "month";
  return "year";
}

function toIsoDateRange(year: number, month?: number | null, day?: number | null) {
  const pad = (n: number) => String(n).padStart(2, "0");

  if (month && day) {
    const d = `${year}-${pad(month)}-${pad(day)}`;
    return {
      start_date: d,
      end_date: d,
      sort_date: d,
    };
  }

  if (month) {
    const start = `${year}-${pad(month)}-01`;
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return {
      start_date: start,
      end_date: end,
      sort_date: `${year}-${pad(month)}-15`,
    };
  }

  return {
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    sort_date: `${year}-06-30`,
  };
}

function findFamilyForParent(records: ImportStagingRecordDraft[], parentExternalId: string) {
  const parentRecord = records.find((record) => {
    return (
      record.record_type === "family_parent" &&
      record.normalized_payload.person_external_id === parentExternalId
    );
  });

  return parentRecord?.normalized_payload.family_external_id ?? "";
}
