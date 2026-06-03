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

export interface ExistingPersonForGedcomMatch {
  id: string;
  full_name?: string | null;
  gender?: string | null;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  death_year?: number | null;
  death_month?: number | null;
  death_day?: number | null;
}

export interface GedcomPersonMatchResult {
  matchedPersonId: string | null;
  matchedPersonName: string | null;
  score: number;
  level: "none" | "weak" | "medium" | "strong";
  reason: string;
}

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
    matches: number;
    possibleMatches: number;
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

export function buildGedcomStagingPreview(
  content: string,
  options?: {
    existingPersons?: ExistingPersonForGedcomMatch[];
  },
): GedcomStagingPreview {
  const warnings: string[] = [];
  const errors: string[] = [];
  const records: ImportStagingRecordDraft[] = [];
  const existingPersons = options?.existingPersons ?? [];

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

  for (const person of parsed.persons ?? []) {
    const externalId = String(
      person.id ?? person.external_id ?? `person_${records.length + 1}`,
    );

    const fullName = getGedcomPersonFullName(person);
    const surname = getGedcomPersonSurname(person);
    const givenName = getGedcomPersonGivenName(person);

    const birthYear = toNullableNumber(person.birth_year);
    const birthMonth = toNullableNumber(person.birth_month);
    const birthDay = toNullableNumber(person.birth_day);
    const deathYear = toNullableNumber(person.death_year);
    const deathMonth = toNullableNumber(person.death_month);
    const deathDay = toNullableNumber(person.death_day);

    const match = findBestExistingPersonMatch(
      {
        full_name: fullName,
        gender: normalizeGender(person.gender),
        birth_year: birthYear,
        birth_month: birthMonth,
        birth_day: birthDay,
        death_year: deathYear,
        death_month: deathMonth,
        death_day: deathDay,
      },
      existingPersons,
    );

    const blocksCreateForPossibleMatch =
      match.level === "strong" ||
      match.level === "medium" ||
      match.level === "weak";

    const personWarnings: string[] = [];
    let action: ImportStagingRecordDraft["action"] = "create";
    let status: ImportStagingRecordDraft["status"] = "pending";
    let confidence: ImportStagingRecordDraft["confidence"] =
      fullName === "Chưa rõ tên" ? "review" : "certain";

    if (fullName === "Chưa rõ tên") {
      personWarnings.push("Person chưa có tên rõ ràng.");
    }

    if (match.level === "strong") {
      action = "match";
      status = "skipped";
      confidence = "certain";
      personWarnings.push(
        `Trùng chắc với person hiện có: ${match.matchedPersonName} (${match.reason}). Record sẽ không tạo mới.`,
      );
    } else if (match.level === "medium") {
      action = "match";
      status = "pending";
      confidence = "review";
      personWarnings.push(
        `Nghi trùng với person hiện có: ${match.matchedPersonName} (${match.reason}). Cần review trước khi tạo mới.`,
      );
    } else if (match.level === "weak") {
      action = "match";
      status = "pending";
      confidence = "review";
      personWarnings.push(
        `Có ứng viên gần giống: ${match.matchedPersonName} (${match.reason}). Cần review trước khi tạo mới.`,
      );
    }

    records.push({
      record_type: "person",
      external_id: externalId,
      parent_external_id: null,
      action,
      confidence,
      status,
      payload: person,
      normalized_payload: {
        external_id: externalId,
        full_name: fullName,
        gender: normalizeGender(person.gender),
        birth_year: birthYear,
        birth_month: birthMonth,
        birth_day: birthDay,
        death_year: deathYear,
        death_month: deathMonth,
        death_day: deathDay,
        is_deceased: Boolean(person.is_deceased || deathYear),
        note: person.note ?? null,
        matched_person_id: match.matchedPersonId,
        matched_person_name: match.matchedPersonName,
        match_score: match.score,
        match_level: match.level,
        match_reason: match.reason,
      },
      warnings: personWarnings,
      errors: [],
      sort_order: records.length,
    });

    records.push({
      record_type: "name",
      external_id: `${externalId}:primary_name`,
      parent_external_id: externalId,
      action: blocksCreateForPossibleMatch ? "skip" : "create",
      confidence: blocksCreateForPossibleMatch ? "review" : confidence,
      status: blocksCreateForPossibleMatch ? "skipped" : "pending",
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
      warnings:
        blocksCreateForPossibleMatch
          ? ["Person đã match/nghi trùng với dữ liệu hiện có, không tạo person_name mới."]
          : [],
      errors: [],
      sort_order: records.length,
    });

    if (birthYear) {
      const eventExternalId = `${externalId}:birth`;
      const dateRange = toIsoDateRange(birthYear, birthMonth, birthDay);

      records.push({
        record_type: "event",
        external_id: eventExternalId,
        parent_external_id: externalId,
        action: blocksCreateForPossibleMatch ? "skip" : "create",
        confidence: blocksCreateForPossibleMatch ? "review" : "certain",
        status: blocksCreateForPossibleMatch ? "skipped" : "pending",
        payload: person,
        normalized_payload: {
          type: "birth",
          legacy_person_external_id: externalId,
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
          sort_date: dateRange.sort_date,
          date_precision: getDatePrecision(birthMonth, birthDay),
          legacy_source: "gedcom.birth",
        },
        warnings:
          blocksCreateForPossibleMatch
            ? ["Person đã match/nghi trùng với dữ liệu hiện có, không tạo birth event mới."]
            : [],
        errors: [],
        sort_order: records.length,
      });

      if (!blocksCreateForPossibleMatch) {
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
    }

    if (deathYear || person.is_deceased) {
      const eventExternalId = `${externalId}:death`;

      records.push({
        record_type: "event",
        external_id: eventExternalId,
        parent_external_id: externalId,
        action: blocksCreateForPossibleMatch ? "skip" : deathYear ? "create" : "skip",
        confidence: blocksCreateForPossibleMatch ? "review" : deathYear ? "certain" : "review",
        status: blocksCreateForPossibleMatch || !deathYear ? "skipped" : "pending",
        payload: person,
        normalized_payload: deathYear
          ? {
              type: "death",
              legacy_person_external_id: externalId,
              start_date: toIsoDateRange(deathYear, deathMonth, deathDay)
                .start_date,
              end_date: toIsoDateRange(deathYear, deathMonth, deathDay).end_date,
              sort_date: toIsoDateRange(deathYear, deathMonth, deathDay)
                .sort_date,
              date_precision: getDatePrecision(deathMonth, deathDay),
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
        warnings:
          blocksCreateForPossibleMatch
            ? ["Person đã match/nghi trùng với dữ liệu hiện có, không tạo death event mới."]
            : deathYear
              ? []
              : [
                  "Person có DEAT Y nhưng không có ngày mất. Sẽ không tạo death event có date.",
                ],
        errors: [],
        sort_order: records.length,
      });

      if (!blocksCreateForPossibleMatch && deathYear) {
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

  const matchedOrPossibleMatchedPersonIds = new Set(
    records
      .filter((record) => record.record_type === "person")
      .filter((record) => record.action === "match")
      .map((record) => record.external_id)
      .filter(Boolean) as string[],
  );

  for (const rel of parsed.relationships ?? []) {
    if (rel.type === "marriage") {
      const a = String(rel.person_a ?? rel.husband_id ?? rel.person1_id ?? "");
      const b = String(rel.person_b ?? rel.wife_id ?? rel.person2_id ?? "");

      if (!a || !b) {
        warnings.push("GEDCOM marriage thiếu spouse id.");
        continue;
      }

      if (matchedOrPossibleMatchedPersonIds.has(a) || matchedOrPossibleMatchedPersonIds.has(b)) {
        records.push({
          record_type: "warning",
          external_id: null,
          parent_external_id: null,
          action: "warning",
          confidence: "manual",
          status: "pending",
          payload: rel,
          normalized_payload: {},
          warnings: [
            "Marriage có người đã match với dữ liệu hiện có. Bỏ qua family create để tránh tạo family trùng.",
          ],
          errors: [],
          sort_order: records.length,
        });
        continue;
      }

      const familyExternalId = String(
        rel.family_id ?? rel.id ?? `family_${records.length + 1}`,
      );

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
          person_external_id: a,
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
          person_external_id: b,
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

    const parentId = String(rel.person_a ?? rel.parent_id ?? "");
    const childId = String(rel.person_b ?? rel.child_id ?? "");

    if (!parentId || !childId) {
      warnings.push("GEDCOM child relationship thiếu parent/child id.");
      continue;
    }

    if (matchedOrPossibleMatchedPersonIds.has(parentId) || matchedOrPossibleMatchedPersonIds.has(childId)) {
      records.push({
        record_type: "warning",
        external_id: null,
        parent_external_id: null,
        action: "warning",
        confidence: "manual",
        status: "pending",
        payload: rel,
        normalized_payload: {},
        warnings: [
          "Child relationship có người đã match với dữ liệu hiện có. Bỏ qua family_child create để tránh tạo quan hệ trùng.",
        ],
        errors: [],
        sort_order: records.length,
      });
      continue;
    }

    const familyExternalId = String(
      rel.family_id ?? rel.parent_family_id ?? findFamilyForParent(records, parentId),
    );

    records.push({
      record_type: "family_child",
      external_id: `${familyExternalId}:${childId}:child`,
      parent_external_id: familyExternalId,
      action: "create",
      confidence: familyExternalId ? "review" : "low",
      status: "pending",
      payload: rel,
      normalized_payload: {
        family_external_id: familyExternalId,
        person_external_id: childId,
        relationship_type: rel.type === "adopted_child" ? "adopted" : "biological",
      },
      warnings: familyExternalId
        ? []
        : ["Không xác định được family cho child relationship."],
      errors: [],
      sort_order: records.length,
    });
  }

  const recordWarnings = records.reduce(
    (sum, record) => sum + record.warnings.length,
    0,
  );
  const recordErrors = records.reduce((sum, record) => sum + record.errors.length, 0);

  return {
    summary: {
      persons: records.filter((r) => r.record_type === "person").length,
      names: records.filter((r) => r.record_type === "name").length,
      families: records.filter((r) => r.record_type === "family").length,
      familyParents: records.filter((r) => r.record_type === "family_parent")
        .length,
      familyChildren: records.filter((r) => r.record_type === "family_child")
        .length,
      events: records.filter((r) => r.record_type === "event").length,
      personEvents: records.filter((r) => r.record_type === "person_event").length,
      matches: records.filter((r) => r.record_type === "person" && r.action === "match")
        .length,
      possibleMatches: records.filter(
        (r) =>
          r.record_type === "person" &&
          r.action === "match" &&
          r.status === "pending",
      ).length,
      warnings: warnings.length + recordWarnings,
      errors: errors.length + recordErrors,
    },
    records,
    warnings,
    errors,
  };
}

function findBestExistingPersonMatch(
  candidate: {
    full_name: string;
    gender: "male" | "female" | "other" | null;
    birth_year: number | null;
    birth_month: number | null;
    birth_day: number | null;
    death_year: number | null;
    death_month: number | null;
    death_day: number | null;
  },
  existingPersons: ExistingPersonForGedcomMatch[],
): GedcomPersonMatchResult {
  const candidateName = normalizeNameForMatch(candidate.full_name);

  if (!candidateName || candidate.full_name === "Chưa rõ tên") {
    return emptyMatch("Không đủ tên để matching.");
  }

  let best: GedcomPersonMatchResult = emptyMatch("Không tìm thấy match.");

  for (const person of existingPersons) {
    const existingName = normalizeNameForMatch(person.full_name ?? "");
    if (!existingName) continue;

    let score = 0;
    const reasons: string[] = [];

    if (candidateName === existingName) {
      score += 60;
      reasons.push("trùng tên");
    } else if (
      candidateName.includes(existingName) ||
      existingName.includes(candidateName)
    ) {
      score += 35;
      reasons.push("tên gần giống");
    }

    if (candidate.birth_year && person.birth_year) {
      if (candidate.birth_year === person.birth_year) {
        score += 25;
        reasons.push("trùng năm sinh");
      } else {
        score -= 25;
        reasons.push("khác năm sinh");
      }
    }

    if (candidate.birth_month && person.birth_month) {
      if (candidate.birth_month === person.birth_month) {
        score += 10;
        reasons.push("trùng tháng sinh");
      } else {
        score -= 10;
      }
    }

    if (candidate.birth_day && person.birth_day) {
      if (candidate.birth_day === person.birth_day) {
        score += 10;
        reasons.push("trùng ngày sinh");
      } else {
        score -= 10;
      }
    }

    if (candidate.gender && person.gender) {
      if (candidate.gender === person.gender) {
        score += 5;
        reasons.push("trùng giới tính");
      } else {
        score -= 15;
        reasons.push("khác giới tính");
      }
    }

    if (candidate.death_year && person.death_year) {
      if (candidate.death_year === person.death_year) {
        score += 10;
        reasons.push("trùng năm mất");
      } else {
        score -= 10;
      }
    }

    const level =
      score >= 90
        ? "strong"
        : score >= 70
          ? "medium"
          : score >= 50
            ? "weak"
            : "none";

    if (score > best.score) {
      best = {
        matchedPersonId: person.id,
        matchedPersonName: person.full_name ?? person.id,
        score,
        level,
        reason: reasons.join(", ") || "điểm matching thấp",
      };
    }
  }

  if (best.level === "none") {
    return emptyMatch("Không tìm thấy match đủ tin cậy.");
  }

  return best;
}

function emptyMatch(reason: string): GedcomPersonMatchResult {
  return {
    matchedPersonId: null,
    matchedPersonName: null,
    score: 0,
    level: "none",
    reason,
  };
}

function normalizeNameForMatch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    matches: 0,
    possibleMatches: 0,
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

function getDatePrecision(
  month?: unknown,
  day?: unknown,
): "year" | "month" | "day" {
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

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function findFamilyForParent(
  records: ImportStagingRecordDraft[],
  parentExternalId: string,
) {
  const parentRecord = records.find((record) => {
    return (
      record.record_type === "family_parent" &&
      record.normalized_payload.person_external_id === parentExternalId
    );
  });

  return parentRecord?.normalized_payload.family_external_id ?? "";
}