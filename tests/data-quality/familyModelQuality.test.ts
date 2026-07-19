import { describe, expect, it } from "vitest";
import { runFamilyModelQualityChecks } from "@/services/data-quality/familyModelQuality.service";

describe("runFamilyModelQualityChecks", () => {
  it("reports legacy marriage without Family Model", () => {
    const result = runFamilyModelQualityChecks({
      persons: [
        { id: "p1", full_name: "Cha" },
        { id: "p2", full_name: "Mẹ" },
      ],
      relationships: [
        { id: "r1", type: "marriage", person_a: "p1", person_b: "p2" },
      ],
      families: [],
      familyParents: [],
      familyChildren: [],
    });

    expect(result.summary.byKind.missing_marriage_family).toBe(1);
    expect(result.issues[0]?.repairable).toBe(true);
  });

  it("does not report legacy marriage when both spouses are in the same family", () => {
    const result = runFamilyModelQualityChecks({
      persons: [
        { id: "p1", full_name: "Cha" },
        { id: "p2", full_name: "Mẹ" },
      ],
      relationships: [
        { id: "r1", type: "marriage", person_a: "p1", person_b: "p2" },
      ],
      families: [{ id: "f1" }],
      familyParents: [
        { family_id: "f1", person_id: "p1" },
        { family_id: "f1", person_id: "p2" },
      ],
      familyChildren: [],
    });

    expect(result.summary.byKind.missing_marriage_family).toBe(0);
  });

  it("reports legacy child relationship without Family Model", () => {
    const result = runFamilyModelQualityChecks({
      persons: [
        { id: "parent", full_name: "Parent" },
        { id: "child", full_name: "Child" },
      ],
      relationships: [
        {
          id: "r1",
          type: "biological_child",
          person_a: "parent",
          person_b: "child",
        },
      ],
      families: [{ id: "f1" }],
      familyParents: [{ family_id: "f1", person_id: "parent" }],
      familyChildren: [],
    });

    expect(result.summary.byKind.missing_child_family).toBe(1);
    expect(result.issues[0]?.repairable).toBe(true);
  });

  it("reports duplicate family parent and child rows", () => {
    const result = runFamilyModelQualityChecks({
      persons: [{ id: "p1" }, { id: "c1" }],
      families: [{ id: "f1" }],
      familyParents: [
        { family_id: "f1", person_id: "p1" },
        { family_id: "f1", person_id: "p1" },
      ],
      familyChildren: [
        { family_id: "f1", person_id: "c1", relationship_type: "biological" },
        { family_id: "f1", person_id: "c1", relationship_type: "biological" },
      ],
    });

    expect(result.summary.byKind.duplicate_family_parent).toBe(1);
    expect(result.summary.byKind.duplicate_family_child).toBe(1);
  });

  it("reports family with child but no parent", () => {
    const result = runFamilyModelQualityChecks({
      persons: [{ id: "child" }],
      families: [{ id: "f1" }],
      familyParents: [],
      familyChildren: [{ family_id: "f1", person_id: "child" }],
    });

    expect(result.summary.byKind.family_child_without_parent).toBe(1);
    expect(result.issues[0]?.repairable).toBe(false);
  });

  it("reports person parent and child in same family", () => {
    const result = runFamilyModelQualityChecks({
      persons: [{ id: "p1", full_name: "Loop" }],
      families: [{ id: "f1" }],
      familyParents: [{ family_id: "f1", person_id: "p1" }],
      familyChildren: [{ family_id: "f1", person_id: "p1" }],
    });

    expect(result.summary.byKind.person_parent_and_child_same_family).toBe(1);
  });
});
