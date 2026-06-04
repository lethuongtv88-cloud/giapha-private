import { describe, expect, it } from "vitest";
import { buildGedcomCommitPlan } from "@/services/import/gedcomCommitPlan.service";

describe("buildGedcomCommitPlan", () => {
  it("builds a valid commit plan for approved records", () => {
    const plan = buildGedcomCommitPlan({
      sessionId: "s1",
      records: [
        {
          id: "r1",
          record_type: "person",
          external_id: "I1",
          parent_external_id: null,
          action: "create",
          confidence: "certain",
          status: "approved",
          normalized_payload: { full_name: "Nguyễn Văn A" },
          warnings: [],
          errors: [],
          sort_order: 1,
        },
        {
          id: "r2",
          record_type: "name",
          external_id: "I1:primary_name",
          parent_external_id: "I1",
          action: "create",
          confidence: "certain",
          status: "approved",
          normalized_payload: {
            person_external_id: "I1",
            full_name: "Nguyễn Văn A",
          },
          warnings: [],
          errors: [],
          sort_order: 2,
        },
      ],
    });

    expect(plan.ok).toBe(true);
    expect(plan.counts.persons).toBe(1);
    expect(plan.counts.personNames).toBe(1);
  });

  it("reports error when name points to unapproved person", () => {
    const plan = buildGedcomCommitPlan({
      sessionId: "s1",
      records: [
        {
          id: "r1",
          record_type: "name",
          external_id: "I1:primary_name",
          parent_external_id: "I1",
          action: "create",
          confidence: "certain",
          status: "approved",
          normalized_payload: {
            person_external_id: "I1",
            full_name: "Nguyễn Văn A",
          },
          warnings: [],
          errors: [],
          sort_order: 1,
        },
      ],
    });

    expect(plan.ok).toBe(false);
    expect(plan.issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  it("ignores non-approved records", () => {
    const plan = buildGedcomCommitPlan({
      sessionId: "s1",
      records: [
        {
          id: "r1",
          record_type: "person",
          external_id: "I1",
          parent_external_id: null,
          action: "create",
          confidence: "certain",
          status: "pending",
          normalized_payload: { full_name: "Nguyễn Văn A" },
          warnings: [],
          errors: [],
          sort_order: 1,
        },
      ],
    });

    expect(plan.approvedRecords).toBe(0);
    expect(plan.counts.persons).toBe(0);
  });
});
  it("blocks commit when pending possible matches remain", () => {
    const plan = buildGedcomCommitPlan({
      sessionId: "s1",
      records: [
        {
          id: "r1",
          record_type: "person",
          external_id: "I1",
          parent_external_id: null,
          action: "match",
          confidence: "review",
          status: "pending",
          normalized_payload: {
            full_name: "Nguyễn Văn A",
            matched_person_id: "existing-p1",
            match_level: "weak",
          },
          warnings: [],
          errors: [],
          sort_order: 1,
        },
      ],
    });

    expect(plan.ok).toBe(false);
    expect(
      plan.issues.some((issue) =>
        issue.title.includes("possible matches chưa duyệt"),
      ),
    ).toBe(true);
  });