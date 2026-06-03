import { describe, expect, it } from "vitest";
import { buildGedcomMergePlan } from "@/services/import/gedcomMergePlan.service";

describe("GEDCOM merge plan", () => {
  it("suggests creating missing birth event for matched person", () => {
    const plan = buildGedcomMergePlan({
      records: [
        {
          id: "p1",
          record_type: "person",
          external_id: "I1",
          parent_external_id: null,
          action: "match",
          status: "skipped",
          normalized_payload: {
            matched_person_id: "existing-p1",
            matched_person_name: "Nguyễn Văn A",
          },
        },
        {
          id: "e1",
          record_type: "event",
          external_id: "I1:birth",
          parent_external_id: "I1",
          action: "skip",
          status: "skipped",
          normalized_payload: {
            type: "birth",
            legacy_person_external_id: "I1",
            start_date: "1980-01-01",
            end_date: "1980-12-31",
            sort_date: "1980-06-30",
            date_precision: "year",
          },
        },
      ],
      existingEvents: [],
    });

    expect(plan.summary.canCreate).toBe(1);
    expect(plan.records[0].status).toBe("can_create");
  });

  it("marks event as already exists when matched person has same event", () => {
    const plan = buildGedcomMergePlan({
      records: [
        {
          id: "p1",
          record_type: "person",
          external_id: "I1",
          parent_external_id: null,
          action: "match",
          status: "skipped",
          normalized_payload: {
            matched_person_id: "existing-p1",
            matched_person_name: "Nguyễn Văn A",
          },
        },
        {
          id: "e1",
          record_type: "event",
          external_id: "I1:birth",
          parent_external_id: "I1",
          action: "skip",
          status: "skipped",
          normalized_payload: {
            type: "birth",
            legacy_person_external_id: "I1",
            start_date: "1980-01-01",
            sort_date: "1980-06-30",
          },
        },
      ],
      existingEvents: [
        {
          id: "existing-e1",
          type: "birth",
          legacy_person_id: "existing-p1",
          start_date: "1980-01-01",
          end_date: "1980-12-31",
          sort_date: "1980-06-30",
        },
      ],
    });

    expect(plan.summary.alreadyExists).toBe(1);
    expect(plan.records[0].status).toBe("already_exists");
  });
});
