import { describe, expect, it } from "vitest";
import { filterPersonEventsForVisiblePersons } from "@/utils/permissions/applyPersonVisibility";
import { runDataQualityChecks } from "@/services/data-quality/dataQuality.service";

describe("event visibility permissions", () => {
  it("keeps only person_events and events linked to visible persons", () => {
    const out = filterPersonEventsForVisiblePersons({
      visiblePersonIds: new Set(["p1"]),
      personEvents: [
        { person_id: "p1", event_id: "e1" },
        { person_id: "p2", event_id: "e2" },
      ],
      events: [
        { id: "e1", type: "birth" },
        { id: "e2", type: "death" },
      ],
    });

    expect(out.personEvents).toEqual([{ person_id: "p1", event_id: "e1" }]);
    expect(out.events.map((event) => event.id)).toEqual(["e1"]);
  });

  it("keeps legacy-person events only when legacy person is visible", () => {
    const out = filterPersonEventsForVisiblePersons({
      visiblePersonIds: new Set(["p1"]),
      personEvents: [],
      events: [
        { id: "e1", type: "birth", legacy_person_id: "p1" },
        { id: "e2", type: "birth", legacy_person_id: "p2" },
      ],
    });

    expect(out.events.map((event) => event.id)).toEqual(["e1"]);
  });

  it("reports broken person_events links in data quality", () => {
    const result = runDataQualityChecks({
      persons: [{ id: "p1", full_name: "Nguyễn Văn A" }],
      events: [{ id: "e1", type: "birth" }],
      personEvents: [
        { person_id: "p-missing", event_id: "e1" },
        { person_id: "p1", event_id: "e-missing" },
      ],
    });

    expect(result.issues.some((issue) => issue.id.includes("missing-person"))).toBe(true);
    expect(result.issues.some((issue) => issue.id.includes("missing-event"))).toBe(true);
  });
});
