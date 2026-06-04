import { describe, expect, it } from "vitest";
import { calculateRootStats } from "@/services/statistics/rootStats.service";
import type { Person } from "@/types";

function person(id: string, gender: Person["gender"]): Person {
  return {
    id,
    full_name: id,
    gender,
    birth_year: null,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    avatar_url: null,
    note: null,
    created_at: "",
    updated_at: "",
    death_lunar_year: null,
    death_lunar_month: null,
    death_lunar_day: null,
    is_deceased: false,
    is_in_law: false,
    birth_order: null,
    generation: null,
    other_names: null,
  };
}

describe("calculateRootStats", () => {
  it("classifies bloodline and in-law by selected root", () => {
    const out = calculateRootStats({
      rootPersonId: "child",
      persons: [
        person("father", "male"),
        person("mother", "female"),
        person("child", "male"),
        person("wife", "female"),
      ],
      families: [
        { id: "f1", status: "active", deleted_at: null },
        { id: "f2", status: "active", deleted_at: null },
      ],
      familyParents: [
        { family_id: "f1", person_id: "father" },
        { family_id: "f1", person_id: "mother" },
        { family_id: "f2", person_id: "child" },
        { family_id: "f2", person_id: "wife" },
      ],
      familyChildren: [{ family_id: "f1", person_id: "child" }],
    });

    expect(out.relation.bloodline).toBeGreaterThanOrEqual(3);
    expect(out.relation.inLaws).toBe(1);

    const wife = out.classifiedPeople.find((p) => p.personId === "wife");
    expect(wife?.className).toBe("spouse_in_law");
  });
});
