import {
  buildGedcomMergePlan,
  type ExistingEventForMerge,
  type MergePlanInputRecord,
} from "./gedcomMergePlan.service";

export type GedcomMergeSuggestionDraft = {
  session_id: string;
  suggestion_type: "create_event";
  status: "pending";
  matched_person_id: string;
  matched_person_name: string;
  source_record_id: string;
  source_external_id: string;
  payload: Record<string, unknown>;
  reason: string;
};

export function buildGedcomMergeSuggestionDrafts(input: {
  sessionId: string;
  records: MergePlanInputRecord[];
  existingEvents: ExistingEventForMerge[];
}): GedcomMergeSuggestionDraft[] {
  const plan = buildGedcomMergePlan({
    records: input.records,
    existingEvents: input.existingEvents,
  });

  return plan.records
    .filter((record) => record.status === "can_create")
    .map((record) => ({
      session_id: input.sessionId,
      suggestion_type: "create_event" as const,
      status: "pending" as const,
      matched_person_id: record.matchedPersonId,
      matched_person_name: record.matchedPersonName,
      source_record_id: findSourceRecordId(input.records, record.eventExternalId),
      source_external_id: record.eventExternalId,
      payload: {
        type: record.type,
        start_date: record.startDate,
        end_date: record.endDate,
        sort_date: record.sortDate,
        date_precision: record.datePrecision,
        legacy_source: "gedcom.merge",
      },
      reason: record.reason,
    }))
    .filter((draft) => {
      return Boolean(
        draft.matched_person_id &&
          draft.source_record_id &&
          draft.source_external_id &&
          draft.payload.type &&
          draft.payload.start_date,
      );
    });
}

function findSourceRecordId(
  records: MergePlanInputRecord[],
  eventExternalId: string,
): string {
  const record = records.find((item) => {
    return item.record_type === "event" && item.external_id === eventExternalId;
  });

  return record?.id ?? "";
}
