import { describe, expect, it } from "vitest";
import { runDataQualityChecks } from "@/services/data-quality/dataQuality.service";

describe("runDataQualityChecks", () => {
  it("reports family with child but no parent", () => {
    const result = runDataQualityChecks({
      persons: [{ id: "child", full_name: "Child" }],
      families: [{ id: "f1", deleted_at: null }],
      familyParents: [],
      familyChildren: [{ family_id: "f1", person_id: "child" }],
    });

    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.issues.some((issue) => issue.id === "family:f1:no-parent")).toBe(true);
  });

  it("reports duplicate birth events", () => {
    const result = runDataQualityChecks({
      persons: [{ id: "p1", full_name: "P1" }],
      events: [
        { id: "e1", type: "birth", legacy_person_id: "p1" },
        { id: "e2", type: "birth", legacy_person_id: "p1" },
      ],
      personEvents: [],
    });

    expect(
      result.issues.some((issue) => issue.id === "person:p1:duplicate-birth-events"),
    ).toBe(true);
  });

  it("reports invalid event date range", () => {
    const result = runDataQualityChecks({
      persons: [],
      events: [
        {
          id: "e1",
          type: "birth",
          start_date: "2020-12-31",
          end_date: "2020-01-01",
        },
      ],
    });

    expect(result.issues.some((issue) => issue.id === "event:e1:invalid-range")).toBe(true);
  });

  it("reports orphan event", () => {
    const result = runDataQualityChecks({
      persons: [],
      families: [],
      events: [{ id: "e1", type: "custom" }],
      personEvents: [],
    });

    expect(result.issues.some((issue) => issue.id === "event:e1:orphan")).toBe(true);
  });

  it("reports death before birth", () => {
    const result = runDataQualityChecks({
      persons: [{ id: "p1", full_name: "P1", is_deceased: true }],
      events: [
        {
          id: "birth",
          type: "birth",
          legacy_person_id: "p1",
          start_date: "2000-01-01",
        },
        {
          id: "death",
          type: "death",
          legacy_person_id: "p1",
          start_date: "1999-01-01",
        },
      ],
    });

    expect(result.issues.some((issue) => issue.id === "person:p1:death-before-birth")).toBe(true);
  });

  it("reports parent-child cycle", () => {
    const result = runDataQualityChecks({
      persons: [
        { id: "a", full_name: "A" },
        { id: "b", full_name: "B" },
      ],
      families: [
        { id: "f1", deleted_at: null },
        { id: "f2", deleted_at: null },
      ],
      familyParents: [
        { family_id: "f1", person_id: "a" },
        { family_id: "f2", person_id: "b" },
      ],
      familyChildren: [
        { family_id: "f1", person_id: "b" },
        { family_id: "f2", person_id: "a" },
      ],
    });

    expect(result.issues.some((issue) => issue.id.startsWith("tree:parent-child-cycle"))).toBe(true);
  });

  it("reports migration review pending", () => {
    const result = runDataQualityChecks({
      persons: [],
      migrationReview: [{ id: "m1", status: "pending" }],
    });

    expect(result.issues.some((issue) => issue.id === "migration_review:pending")).toBe(true);
  });
});
