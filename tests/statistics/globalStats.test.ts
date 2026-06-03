import { describe, expect, it } from "vitest";
import { calculateGlobalStats } from "@/services/statistics/globalStats.service";
import type { Person } from "@/types";

function person(id: string, gender: Person["gender"], is_deceased = false): Person {
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
    is_deceased,
    is_in_law: false,
    birth_order: null,
    generation: null,
    other_names: null,
  };
}

describe("calculateGlobalStats", () => {
  it("counts gender, life status, families, events, married and children", () => {
    const out = calculateGlobalStats({
      persons: [
        person("p1", "male"),
        person("p2", "female"),
        person("p3", "male", true),
      ],
      families: [{ id: "f1", status: "active", deleted_at: null }],
      familyParents: [
        { family_id: "f1", person_id: "p1" },
        { family_id: "f1", person_id: "p2" },
      ],
      familyChildren: [{ family_id: "f1", person_id: "p3" }],
      events: [{ id: "e1", type: "birth", deleted_at: null }],
    });

    expect(out.totalPersons).toBe(3);
    expect(out.gender.male).toBe(2);
    expect(out.gender.female).toBe(1);
    expect(out.lifeStatus.deceased).toBe(1);
    expect(out.maritalStatus.married).toBe(2);
    expect(out.childStatus.hasChildren).toBe(2);
    expect(out.totals.families).toBe(1);
    expect(out.totals.events).toBe(1);
  });
});
