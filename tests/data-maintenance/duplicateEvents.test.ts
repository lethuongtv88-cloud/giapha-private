import { describe, expect, it } from "vitest";
import { buildDuplicateEventGroups } from "@/services/data-maintenance/duplicateEvents.service";

describe("duplicate events maintenance", () => {
  it("groups duplicate birth/death events by person type and date", () => {
    const groups = buildDuplicateEventGroups({
      persons: [{ id: "p1", full_name: "Nguyễn Văn A" }],
      events: [
        {
          id: "e1",
          type: "birth",
          legacy_person_id: "p1",
          start_date: "1980-01-01",
          sort_date: "1980-06-30",
        },
        {
          id: "e2",
          type: "birth",
          legacy_person_id: "p1",
          start_date: "1980-01-01",
          sort_date: "1980-06-30",
        },
        {
          id: "e3",
          type: "death",
          legacy_person_id: "p1",
          start_date: "2020-01-01",
          sort_date: "2020-06-30",
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].eventIds).toEqual(["e1", "e2"]);
  });

  it("ignores deleted events", () => {
    const groups = buildDuplicateEventGroups({
      persons: [{ id: "p1", full_name: "Nguyễn Văn A" }],
      events: [
        {
          id: "e1",
          type: "birth",
          legacy_person_id: "p1",
          start_date: "1980-01-01",
          sort_date: "1980-06-30",
        },
        {
          id: "e2",
          type: "birth",
          legacy_person_id: "p1",
          start_date: "1980-01-01",
          sort_date: "1980-06-30",
          deleted_at: "2026-06-04",
        },
      ],
    });

    expect(groups).toHaveLength(0);
  });
});
