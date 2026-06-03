export type MergePlanEventType = "birth" | "death";

export type MergePlanRecord = {
  personExternalId: string;
  matchedPersonId: string;
  matchedPersonName: string;
  eventExternalId: string;
  type: MergePlanEventType;
  startDate: string | null;
  endDate: string | null;
  sortDate: string | null;
  datePrecision: string | null;
  status: "can_create" | "already_exists" | "missing_date" | "invalid";
  reason: string;
};

export type MergePlanSummary = {
  matchedPersons: number;
  skippedEvents: number;
  canCreate: number;
  alreadyExists: number;
  missingDate: number;
  invalid: number;
};

export type MergePlanInputRecord = {
  id: string;
  record_type: string;
  external_id: string | null;
  parent_external_id: string | null;
  action: string;
  status: string;
  normalized_payload: Record<string, any> | null;
};

export type ExistingEventForMerge = {
  id: string;
  type: string;
  legacy_person_id: string | null;
  start_date: string | null;
  end_date: string | null;
  sort_date: string | null;
  deleted_at?: string | null;
};

export function buildGedcomMergePlan(input: {
  records: MergePlanInputRecord[];
  existingEvents: ExistingEventForMerge[];
}) {
  const personMatches = new Map<
    string,
    {
      matchedPersonId: string;
      matchedPersonName: string;
    }
  >();

  for (const record of input.records) {
    if (record.record_type !== "person") continue;
    if (record.action !== "match") continue;

    const payload = record.normalized_payload ?? {};
    const externalId = record.external_id ?? payload.external_id;
    const matchedPersonId = payload.matched_person_id;
    const matchedPersonName = payload.matched_person_name ?? matchedPersonId;

    if (!externalId || !matchedPersonId) continue;

    personMatches.set(String(externalId), {
      matchedPersonId: String(matchedPersonId),
      matchedPersonName: String(matchedPersonName),
    });
  }

  const activeEvents = input.existingEvents.filter((event) => !event.deleted_at);

  const records: MergePlanRecord[] = [];

  for (const record of input.records) {
    if (record.record_type !== "event") continue;

    const payload = record.normalized_payload ?? {};
    const type = payload.type;

    if (type !== "birth" && type !== "death") continue;

    const personExternalId =
      payload.legacy_person_external_id ?? record.parent_external_id;

    if (!personExternalId) {
      records.push({
        personExternalId: "",
        matchedPersonId: "",
        matchedPersonName: "",
        eventExternalId: record.external_id ?? "",
        type,
        startDate: payload.start_date ?? null,
        endDate: payload.end_date ?? null,
        sortDate: payload.sort_date ?? null,
        datePrecision: payload.date_precision ?? null,
        status: "invalid",
        reason: "Event staging thiếu legacy_person_external_id.",
      });
      continue;
    }

    const match = personMatches.get(String(personExternalId));

    if (!match) {
      records.push({
        personExternalId: String(personExternalId),
        matchedPersonId: "",
        matchedPersonName: "",
        eventExternalId: record.external_id ?? "",
        type,
        startDate: payload.start_date ?? null,
        endDate: payload.end_date ?? null,
        sortDate: payload.sort_date ?? null,
        datePrecision: payload.date_precision ?? null,
        status: "invalid",
        reason: "Không tìm thấy matched person cho event này.",
      });
      continue;
    }

    if (!payload.start_date) {
      records.push({
        personExternalId: String(personExternalId),
        matchedPersonId: match.matchedPersonId,
        matchedPersonName: match.matchedPersonName,
        eventExternalId: record.external_id ?? "",
        type,
        startDate: payload.start_date ?? null,
        endDate: payload.end_date ?? null,
        sortDate: payload.sort_date ?? null,
        datePrecision: payload.date_precision ?? null,
        status: "missing_date",
        reason: "GEDCOM event không có start_date nên chưa tạo merge suggestion.",
      });
      continue;
    }

    const sameTypeEvents = activeEvents.filter((event) => {
      return (
        event.legacy_person_id === match.matchedPersonId &&
        event.type === type
      );
    });

    const exactExisting = sameTypeEvents.find((event) => {
      return (
        event.start_date === payload.start_date ||
        event.sort_date === payload.sort_date
      );
    });

    if (exactExisting || sameTypeEvents.length > 0) {
      records.push({
        personExternalId: String(personExternalId),
        matchedPersonId: match.matchedPersonId,
        matchedPersonName: match.matchedPersonName,
        eventExternalId: record.external_id ?? "",
        type,
        startDate: payload.start_date ?? null,
        endDate: payload.end_date ?? null,
        sortDate: payload.sort_date ?? null,
        datePrecision: payload.date_precision ?? null,
        status: "already_exists",
        reason: exactExisting
          ? "DB đã có event cùng type và ngày tương ứng."
          : "DB đã có event cùng type cho person này.",
      });
      continue;
    }

    records.push({
      personExternalId: String(personExternalId),
      matchedPersonId: match.matchedPersonId,
      matchedPersonName: match.matchedPersonName,
      eventExternalId: record.external_id ?? "",
      type,
      startDate: payload.start_date ?? null,
      endDate: payload.end_date ?? null,
      sortDate: payload.sort_date ?? null,
      datePrecision: payload.date_precision ?? null,
      status: "can_create",
      reason: "DB chưa có event cùng type cho matched person này.",
    });
  }

  const summary: MergePlanSummary = {
    matchedPersons: personMatches.size,
    skippedEvents: input.records.filter(
      (record) => record.record_type === "event" && record.action === "skip",
    ).length,
    canCreate: records.filter((record) => record.status === "can_create").length,
    alreadyExists: records.filter((record) => record.status === "already_exists")
      .length,
    missingDate: records.filter((record) => record.status === "missing_date")
      .length,
    invalid: records.filter((record) => record.status === "invalid").length,
  };

  return {
    ok: summary.invalid === 0,
    summary,
    records,
  };
}
