import { describe, expect, it } from "vitest";
import { buildVisiblePersons, filterPersonEventsByVisiblePersons } from "@/utils/permissions/visiblePersons";

const persons = [
  "root",
  "father",
  "mother",
  "paternal_grandfather",
  "paternal_grandmother",
  "maternal_grandfather",
  "maternal_grandmother",
  "uncle",
  "uncle_wife",
  "uncle_wife_father",
  "sibling",
  "sibling_spouse",
  "sibling_spouse_mother",
  "spouse",
  "spouse_father",
  "spouse_mother",
  "spouse_sibling",
  "spouse_sibling_spouse",
  "child",
].map((id) => ({ id }));

const relationships = [
  { type: "biological_child", person_a: "paternal_grandfather", person_b: "father" },
  { type: "biological_child", person_a: "paternal_grandmother", person_b: "father" },
  { type: "biological_child", person_a: "maternal_grandfather", person_b: "mother" },
  { type: "biological_child", person_a: "maternal_grandmother", person_b: "mother" },
  { type: "biological_child", person_a: "father", person_b: "root" },
  { type: "biological_child", person_a: "mother", person_b: "root" },
  { type: "biological_child", person_a: "father", person_b: "sibling" },
  { type: "biological_child", person_a: "mother", person_b: "sibling" },
  { type: "biological_child", person_a: "paternal_grandfather", person_b: "uncle" },
  { type: "biological_child", person_a: "paternal_grandmother", person_b: "uncle" },
  { type: "biological_child", person_a: "spouse_father", person_b: "spouse" },
  { type: "biological_child", person_a: "spouse_mother", person_b: "spouse" },
  { type: "biological_child", person_a: "spouse_father", person_b: "spouse_sibling" },
  { type: "biological_child", person_a: "spouse_mother", person_b: "spouse_sibling" },
  { type: "biological_child", person_a: "root", person_b: "child" },
  { type: "biological_child", person_a: "spouse", person_b: "child" },
  { type: "marriage", person_a: "uncle", person_b: "uncle_wife" },
  { type: "marriage", person_a: "sibling", person_b: "sibling_spouse" },
  { type: "marriage", person_a: "root", person_b: "spouse" },
  { type: "marriage", person_a: "spouse_sibling", person_b: "spouse_sibling_spouse" },
  { type: "biological_child", person_a: "uncle_wife_father", person_b: "uncle_wife" },
  { type: "biological_child", person_a: "sibling_spouse_mother", person_b: "sibling_spouse" },
];

describe("buildVisiblePersons", () => {
  it("shows the viewer lineage, spouses in that lineage, and direct spouse lineage", () => {
    const result = buildVisiblePersons({
      viewerPersonId: "root",
      role: "member",
      persons,
      relationships,
    });

    expect(result.visiblePersonIds.has("root")).toBe(true);
    expect(result.visiblePersonIds.has("father")).toBe(true);
    expect(result.visiblePersonIds.has("mother")).toBe(true);
    expect(result.visiblePersonIds.has("paternal_grandfather")).toBe(true);
    expect(result.visiblePersonIds.has("maternal_grandmother")).toBe(true);
    expect(result.visiblePersonIds.has("sibling")).toBe(true);
    expect(result.visiblePersonIds.has("uncle")).toBe(true);
    expect(result.visiblePersonIds.has("child")).toBe(true);

    expect(result.visiblePersonIds.has("uncle_wife")).toBe(true);
    expect(result.visiblePersonIds.has("sibling_spouse")).toBe(true);

    expect(result.visiblePersonIds.has("spouse")).toBe(true);
    expect(result.visiblePersonIds.has("spouse_father")).toBe(true);
    expect(result.visiblePersonIds.has("spouse_mother")).toBe(true);
    expect(result.visiblePersonIds.has("spouse_sibling")).toBe(true);
    expect(result.visiblePersonIds.has("spouse_sibling_spouse")).toBe(true);
  });

  it("does not show families of spouses of other people in the viewer lineage", () => {
    const result = buildVisiblePersons({
      viewerPersonId: "root",
      role: "member",
      persons,
      relationships,
    });

    expect(result.visiblePersonIds.has("uncle_wife")).toBe(true);
    expect(result.visiblePersonIds.has("uncle_wife_father")).toBe(false);
    expect(result.visiblePersonIds.has("sibling_spouse")).toBe(true);
    expect(result.visiblePersonIds.has("sibling_spouse_mother")).toBe(false);
  });

  it("allows admin to see all active persons", () => {
    const result = buildVisiblePersons({
      viewerPersonId: null,
      role: "admin",
      persons,
      relationships,
    });

    expect(result.visiblePersonIds.size).toBe(persons.length);
    expect(result.reasonByPersonId.get("uncle_wife_father")).toBe("admin");
  });

  it("filters events by visible person ids", () => {
    const result = buildVisiblePersons({
      viewerPersonId: "root",
      role: "member",
      persons,
      relationships,
    });

    const filtered = filterPersonEventsByVisiblePersons({
      visiblePersonIds: result.visiblePersonIds,
      personEvents: [
        { person_id: "root", event_id: "e-root" },
        { person_id: "uncle_wife_father", event_id: "e-hidden" },
      ],
      events: [{ id: "e-root" }, { id: "e-hidden" }],
    });

    expect(filtered.personEvents.map((event) => event.event_id)).toEqual(["e-root"]);
    expect(filtered.events.map((event) => event.id)).toEqual(["e-root"]);
  });
});
