import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildGedcomCommitPlan,
  type StagingRecordForCommitPlan,
} from "@/services/import/gedcomCommitPlan.service";

export interface GedcomCommitResult {
  ok: boolean;
  sessionId: string;
  committed: {
    persons: number;
    personNames: number;
    families: number;
    familyParents: number;
    familyChildren: number;
    events: number;
    personEvents: number;
    stagingRecords: number;
  };
  errors: string[];
  warnings: string[];
}

interface StagingRecordForCommit extends StagingRecordForCommitPlan {
  payload?: Record<string, any>;
}

type IdMap = Map<string, string>;

export async function commitApprovedGedcomStaging(input: {
  supabase: SupabaseClient;
  sessionId: string;
}): Promise<GedcomCommitResult> {
  const { supabase, sessionId } = input;

  const { data: session, error: sessionError } = await supabase
    .from("import_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return fail(sessionId, sessionError?.message ?? "Không tìm thấy import session.");
  }

  if (session.status === "committed") {
    return fail(sessionId, "Session này đã committed trước đó.");
  }

  const { data: recordsRaw, error: recordsError } = await supabase
    .from("import_staging_records")
    .select(
      "id, record_type, external_id, parent_external_id, action, confidence, status, payload, normalized_payload, warnings, errors, sort_order",
    )
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  if (recordsError) {
    return fail(sessionId, recordsError.message);
  }

  const records = (recordsRaw ?? []) as StagingRecordForCommit[];

  const plan = buildGedcomCommitPlan({
    sessionId,
    records,
  });

  if (!plan.ok) {
    return {
      ok: false,
      sessionId,
      committed: emptyCommitted(),
      errors: plan.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => `${issue.title}: ${issue.description}`),
      warnings: plan.issues
        .filter((issue) => issue.severity !== "error")
        .map((issue) => `${issue.title}: ${issue.description}`),
    };
  }

  const approved = records
    .filter((record) => record.status === "approved")
    .filter((record) => record.action === "create")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const personRecords = approved.filter((record) => record.record_type === "person");
  const nameRecords = approved.filter((record) => record.record_type === "name");
  const familyRecords = approved.filter((record) => record.record_type === "family");
  const familyParentRecords = approved.filter(
    (record) => record.record_type === "family_parent",
  );
  const familyChildRecords = approved.filter(
    (record) => record.record_type === "family_child",
  );
  const eventRecords = approved.filter((record) => record.record_type === "event");
  const personEventRecords = approved.filter(
    (record) => record.record_type === "person_event",
  );

  const committed = emptyCommitted();
  const warnings: string[] = [];
  const errors: string[] = [];

  const personIdMap: IdMap = new Map();
  const familyIdMap: IdMap = new Map();
  const eventIdMap: IdMap = new Map();

  const personResult = await insertPersons({
    supabase,
    records: personRecords,
    personIdMap,
  });
  committed.persons = personResult.count;
  errors.push(...personResult.errors);
  warnings.push(...personResult.warnings);

  if (errors.length > 0) return failWith(sessionId, committed, errors, warnings);

  const nameResult = await insertPersonNames({
    supabase,
    records: nameRecords,
    personIdMap,
  });
  committed.personNames = nameResult.count;
  errors.push(...nameResult.errors);
  warnings.push(...nameResult.warnings);

  if (errors.length > 0) return failWith(sessionId, committed, errors, warnings);

  const familyResult = await insertFamilies({
    supabase,
    records: familyRecords,
    familyIdMap,
  });
  committed.families = familyResult.count;
  errors.push(...familyResult.errors);
  warnings.push(...familyResult.warnings);

  if (errors.length > 0) return failWith(sessionId, committed, errors, warnings);

  const familyParentResult = await insertFamilyParents({
    supabase,
    records: familyParentRecords,
    personIdMap,
    familyIdMap,
  });
  committed.familyParents = familyParentResult.count;
  errors.push(...familyParentResult.errors);
  warnings.push(...familyParentResult.warnings);

  if (errors.length > 0) return failWith(sessionId, committed, errors, warnings);

  const familyChildResult = await insertFamilyChildren({
    supabase,
    records: familyChildRecords,
    personIdMap,
    familyIdMap,
  });
  committed.familyChildren = familyChildResult.count;
  errors.push(...familyChildResult.errors);
  warnings.push(...familyChildResult.warnings);

  if (errors.length > 0) return failWith(sessionId, committed, errors, warnings);

  const eventResult = await insertEvents({
    supabase,
    records: eventRecords,
    personIdMap,
    familyIdMap,
    eventIdMap,
  });
  committed.events = eventResult.count;
  errors.push(...eventResult.errors);
  warnings.push(...eventResult.warnings);

  if (errors.length > 0) return failWith(sessionId, committed, errors, warnings);

  const personEventResult = await insertPersonEvents({
    supabase,
    records: personEventRecords,
    personIdMap,
    eventIdMap,
  });
  committed.personEvents = personEventResult.count;
  errors.push(...personEventResult.errors);
  warnings.push(...personEventResult.warnings);

  if (errors.length > 0) return failWith(sessionId, committed, errors, warnings);

  const approvedIds = approved.map((record) => record.id);

  if (approvedIds.length > 0) {
    const { error: markError } = await supabase
      .from("import_staging_records")
      .update({
        status: "committed",
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .in("id", approvedIds);

    if (markError) {
      return failWith(
        sessionId,
        committed,
        [`Đã insert dữ liệu nhưng không mark staging committed được: ${markError.message}`],
        warnings,
      );
    }

    committed.stagingRecords = approvedIds.length;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: sessionUpdateError } = await supabase
    .from("import_sessions")
    .update({
      status: "committed",
      committed_by: user?.id ?? null,
      committed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      summary: {
        committed,
      },
    })
    .eq("id", sessionId);

  if (sessionUpdateError) {
    return failWith(
      sessionId,
      committed,
      [`Đã insert dữ liệu nhưng không update import_sessions được: ${sessionUpdateError.message}`],
      warnings,
    );
  }

  return {
    ok: true,
    sessionId,
    committed,
    errors,
    warnings,
  };
}

async function insertPersons(input: {
  supabase: SupabaseClient;
  records: StagingRecordForCommit[];
  personIdMap: IdMap;
}) {
  const rows = input.records.map((record) => {
    const p = record.normalized_payload;

    return {
      full_name: String(p.full_name ?? "Chưa rõ tên"),
      gender: normalizeGenderForDb(p.gender),
      birth_year: toNullableNumber(p.birth_year),
      birth_month: toNullableNumber(p.birth_month),
      birth_day: toNullableNumber(p.birth_day),
      death_year: toNullableNumber(p.death_year),
      death_month: toNullableNumber(p.death_month),
      death_day: toNullableNumber(p.death_day),
      is_deceased: Boolean(p.is_deceased),
      note: p.note ? String(p.note) : null,
    };
  });

  if (rows.length === 0) {
    return success(0);
  }

  const { data, error } = await input.supabase
    .from("persons")
    .insert(rows)
    .select("id");

  if (error) {
    return failure(`Insert persons lỗi: ${error.message}`);
  }

  const created = data ?? [];

  for (let i = 0; i < input.records.length; i += 1) {
    const externalId = input.records[i].external_id;
    const createdId = created[i]?.id;

    if (externalId && createdId) {
      input.personIdMap.set(externalId, createdId);
    }
  }

  return success(created.length);
}

async function insertPersonNames(input: {
  supabase: SupabaseClient;
  records: StagingRecordForCommit[];
  personIdMap: IdMap;
}) {
  const errors: string[] = [];

  const rows = input.records.flatMap((record) => {
    const p = record.normalized_payload;
    const personExternalId = p.person_external_id;
    const personId = personExternalId ? input.personIdMap.get(String(personExternalId)) : null;

    if (!personId) {
      errors.push(`person_name ${record.id} không map được person_external_id=${personExternalId}`);
      return [];
    }

    return [
      {
        person_id: personId,
        full_name: String(p.full_name ?? "Chưa rõ tên"),
        name_type: p.name_type ? String(p.name_type) : "primary",
        is_primary: Boolean(p.is_primary ?? true),
        sort_order: 0,
      },
    ];
  });

  if (errors.length > 0) return { count: 0, errors, warnings: [] };
  if (rows.length === 0) return success(0);

  const { data, error } = await input.supabase
    .from("person_names")
    .insert(rows)
    .select("id");

  if (error) {
    return failure(`Insert person_names lỗi: ${error.message}`);
  }

  return success((data ?? []).length);
}

async function insertFamilies(input: {
  supabase: SupabaseClient;
  records: StagingRecordForCommit[];
  familyIdMap: IdMap;
}) {
  const rows = input.records.map((record) => {
    const p = record.normalized_payload;

    return {
      status: normalizeFamilyStatus(p.status),
    };
  });

  if (rows.length === 0) return success(0);

  const { data, error } = await input.supabase
    .from("families")
    .insert(rows)
    .select("id");

  if (error) {
    return failure(`Insert families lỗi: ${error.message}`);
  }

  const created = data ?? [];

  for (let i = 0; i < input.records.length; i += 1) {
    const externalId = input.records[i].external_id;
    const createdId = created[i]?.id;

    if (externalId && createdId) {
      input.familyIdMap.set(externalId, createdId);
    }
  }

  return success(created.length);
}

async function insertFamilyParents(input: {
  supabase: SupabaseClient;
  records: StagingRecordForCommit[];
  personIdMap: IdMap;
  familyIdMap: IdMap;
}) {
  const errors: string[] = [];

  const rows = input.records.flatMap((record) => {
    const p = record.normalized_payload;

    const familyId = p.family_external_id
      ? input.familyIdMap.get(String(p.family_external_id))
      : null;

    const personId = p.person_external_id
      ? input.personIdMap.get(String(p.person_external_id))
      : null;

    if (!familyId || !personId) {
      errors.push(
        `family_parent ${record.id} không map được family/person external id.`,
      );
      return [];
    }

    return [
      {
        family_id: familyId,
        person_id: personId,
        role: normalizeParentRole(p.role),
        sort_order: toNullableNumber(p.sort_order) ?? 0,
      },
    ];
  });

  if (errors.length > 0) return { count: 0, errors, warnings: [] };
  if (rows.length === 0) return success(0);

  const { data, error } = await input.supabase
    .from("family_parents")
    .insert(rows)
    .select("id");

  if (error) {
    return failure(`Insert family_parents lỗi: ${error.message}`);
  }

  return success((data ?? []).length);
}

async function insertFamilyChildren(input: {
  supabase: SupabaseClient;
  records: StagingRecordForCommit[];
  personIdMap: IdMap;
  familyIdMap: IdMap;
}) {
  const errors: string[] = [];

  const rows = input.records.flatMap((record) => {
    const p = record.normalized_payload;

    const familyId = p.family_external_id
      ? input.familyIdMap.get(String(p.family_external_id))
      : null;

    const personId = p.person_external_id
      ? input.personIdMap.get(String(p.person_external_id))
      : null;

    if (!familyId || !personId) {
      errors.push(`family_child ${record.id} không map được family/person external id.`);
      return [];
    }

    return [
      {
        family_id: familyId,
        person_id: personId,
        relationship_type: normalizeChildRelationshipType(p.relationship_type),
        sort_order: toNullableNumber(p.sort_order) ?? 0,
      },
    ];
  });

  if (errors.length > 0) return { count: 0, errors, warnings: [] };
  if (rows.length === 0) return success(0);

  const { data, error } = await input.supabase
    .from("family_children")
    .insert(rows)
    .select("id");

  if (error) {
    return failure(`Insert family_children lỗi: ${error.message}`);
  }

  return success((data ?? []).length);
}

async function insertEvents(input: {
  supabase: SupabaseClient;
  records: StagingRecordForCommit[];
  personIdMap: IdMap;
  familyIdMap: IdMap;
  eventIdMap: IdMap;
}) {
  const rows = input.records.map((record) => {
    const p = record.normalized_payload;

    const legacyPersonId = p.legacy_person_external_id
      ? input.personIdMap.get(String(p.legacy_person_external_id))
      : null;

    const familyId = p.family_external_id
      ? input.familyIdMap.get(String(p.family_external_id))
      : null;

    return {
      type: String(p.type ?? "custom"),
      start_date: p.start_date ?? null,
      end_date: p.end_date ?? null,
      sort_date: p.sort_date ?? null,
      date_precision: p.date_precision ?? "unknown",
      date_modifier: p.date_modifier ?? "unknown",
      canonical_calendar: p.canonical_calendar ?? "gregorian",
      date_original_text: p.date_original_text ?? null,
      date_phrase: p.date_phrase ?? null,
      lunar_year: toNullableNumber(p.lunar_year),
      lunar_month: toNullableNumber(p.lunar_month),
      lunar_day: toNullableNumber(p.lunar_day),
      lunar_is_leap_month: Boolean(p.lunar_is_leap_month),
      place_text: p.place_text ?? null,
      description: p.description ?? null,
      family_id: familyId,
      legacy_person_id: legacyPersonId,
      legacy_source: p.legacy_source ? String(p.legacy_source) : "gedcom.staging",
      migration_confidence: "review",
    };
  });

  if (rows.length === 0) return success(0);

  const { data, error } = await input.supabase
    .from("events")
    .insert(rows)
    .select("id");

  if (error) {
    return failure(`Insert events lỗi: ${error.message}`);
  }

  const created = data ?? [];

  for (let i = 0; i < input.records.length; i += 1) {
    const externalId = input.records[i].external_id;
    const createdId = created[i]?.id;

    if (externalId && createdId) {
      input.eventIdMap.set(externalId, createdId);
    }
  }

  return success(created.length);
}

async function insertPersonEvents(input: {
  supabase: SupabaseClient;
  records: StagingRecordForCommit[];
  personIdMap: IdMap;
  eventIdMap: IdMap;
}) {
  const errors: string[] = [];

  const rows = input.records.flatMap((record) => {
    const p = record.normalized_payload;

    const personId = p.person_external_id
      ? input.personIdMap.get(String(p.person_external_id))
      : null;

    const eventId = p.event_external_id
      ? input.eventIdMap.get(String(p.event_external_id))
      : null;

    if (!personId || !eventId) {
      errors.push(`person_event ${record.id} không map được person/event external id.`);
      return [];
    }

    return [
      {
        person_id: personId,
        event_id: eventId,
        role: normalizeEventRole(p.role),
        sort_order: toNullableNumber(p.sort_order) ?? 0,
      },
    ];
  });

  if (errors.length > 0) return { count: 0, errors, warnings: [] };
  if (rows.length === 0) return success(0);

  const { data, error } = await input.supabase
    .from("person_events")
    .insert(rows)
    .select("id");

  if (error) {
    return failure(`Insert person_events lỗi: ${error.message}`);
  }

  return success((data ?? []).length);
}

function normalizeGenderForDb(value: unknown) {
  if (value === "male" || value === "female" || value === "other") return value;
  return "other";
}

function normalizeFamilyStatus(value: unknown) {
  if (value === "divorced" || value === "separated") return value;
  return "active";
}

function normalizeParentRole(value: unknown) {
  if (value === "husband" || value === "wife") return value;
  return "parent";
}

function normalizeChildRelationshipType(value: unknown) {
  if (value === "adopted") return "adopted";
  if (value === "step") return "step";
  return "biological";
}

function normalizeEventRole(value: unknown) {
  if (
    value === "principal" ||
    value === "child" ||
    value === "husband" ||
    value === "wife" ||
    value === "witness" ||
    value === "officiant" ||
    value === "deceased" ||
    value === "participant"
  ) {
    return value;
  }

  return "principal";
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptyCommitted(): GedcomCommitResult["committed"] {
  return {
    persons: 0,
    personNames: 0,
    families: 0,
    familyParents: 0,
    familyChildren: 0,
    events: 0,
    personEvents: 0,
    stagingRecords: 0,
  };
}

function success(count: number) {
  return {
    count,
    errors: [] as string[],
    warnings: [] as string[],
  };
}

function failure(message: string) {
  return {
    count: 0,
    errors: [message],
    warnings: [] as string[],
  };
}

function fail(sessionId: string, message: string): GedcomCommitResult {
  return {
    ok: false,
    sessionId,
    committed: emptyCommitted(),
    errors: [message],
    warnings: [],
  };
}

function failWith(
  sessionId: string,
  committed: GedcomCommitResult["committed"],
  errors: string[],
  warnings: string[],
): GedcomCommitResult {
  return {
    ok: false,
    sessionId,
    committed,
    errors,
    warnings,
  };
}
