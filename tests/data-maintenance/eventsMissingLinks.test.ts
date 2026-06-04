import { describe, expect, it } from "vitest";
import { buildEventsMissingLinksRows } from "@/services/data-maintenance/eventsMissingLinks.service";

describe("events missing links maintenance", () => {
  it("finds birth/death events missing person_events link", () => {
    const rows = buildEventsMissingLinksRows({
      persons: [{ id: "p1", full_name: "Nguyễn Văn A" }],
      personEvents: [],
      events: [
        {
          id: "e1",
          type: "birth",
          legacy_person_id: "p1",
          start_date: "1980-01-01",
          sort_date: "1980-06-30",
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventId: "e1",
      personId: "p1",
      personName: "Nguyễn Văn A",
      type: "birth",
      role: "principal",
    });
  });

  it("ignores events that already have matching person_events link", () => {
    const rows = buildEventsMissingLinksRows({
      persons: [{ id: "p1", full_name: "Nguyễn Văn A" }],
      personEvents: [
        {
          person_id: "p1",
          event_id: "e1",
          role: "principal",
        },
      ],
      events: [
        {
          id: "e1",
          type: "birth",
          legacy_person_id: "p1",
          start_date: "1980-01-01",
          sort_date: "1980-06-30",
        },
      ],
    });

    expect(rows).toHaveLength(0);
  });

  it("uses deceased role for death events", () => {
    const rows = buildEventsMissingLinksRows({
      persons: [{ id: "p1", full_name: "Nguyễn Văn A" }],
      personEvents: [],
      events: [
        {
          id: "e1",
          type: "death",
          legacy_person_id: "p1",
          start_date: "2020-01-01",
          sort_date: "2020-06-30",
        },
      ],
    });

    expect(rows[0].role).toBe("deceased");
  });
});
