import { describe, expect, it } from "vitest";
import { computeKinship, type KinshipPersonNode, type KinshipRelationshipEdge } from "../../utils/kinshipHelpers";

const person = (
  id: string,
  fullName: string,
  extra: Partial<KinshipPersonNode> = {},
): KinshipPersonNode => ({
  id,
  full_name: fullName,
  gender: "other",
  birth_year: null,
  birth_order: null,
  generation: null,
  is_in_law: false,
  ...extra,
});

const child = (parent: string, childId: string): KinshipRelationshipEdge => ({
  person_a: parent,
  person_b: childId,
  type: "biological_child",
});

describe("computeKinship", () => {
  it("recognizes a younger male sibling of the maternal grandmother as ông cậu ngoại and inverse as cháu", () => {
    const persons = [
      person("viet", "Lê Quốc Việt", { gender: "male" }),
      person("mother", "Mẹ của Việt", { gender: "female" }),
      person("grandmother", "Bà ngoại của Việt", { gender: "female", birth_year: 1940 }),
      person("great", "Cụ ngoại", { gender: "male" }),
      person("cau", "Hồ Văn Nên", { gender: "male", birth_year: 1950 }),
    ];
    const relationships = [
      child("mother", "viet"),
      child("grandmother", "mother"),
      child("great", "grandmother"),
      child("great", "cau"),
    ];

    const result = computeKinship(persons[0], persons[4], persons, relationships);

    expect(result?.aCallsB).toBe("ông cậu ngoại");
    expect(result?.bCallsA).toBe("cháu");
  });

  it("uses branch seniority for same-generation cousins", () => {
    const persons = [
      person("root", "Người gốc", { gender: "male" }),
      person("rootParent", "Cha người gốc", { gender: "male", birth_year: 1970 }),
      person("grand", "Ông", { gender: "male" }),
      person("olderUncle", "Bác", { gender: "male", birth_year: 1960 }),
      person("cousin", "Con bác", { gender: "female" }),
    ];
    const relationships = [
      child("rootParent", "root"),
      child("grand", "rootParent"),
      child("grand", "olderUncle"),
      child("olderUncle", "cousin"),
    ];

    const result = computeKinship(persons[0], persons[4], persons, relationships);

    expect(result?.aCallsB).toBe("chị họ");
  });

  it("uses Vietnamese affinal terms for spouses of aunt/uncle/siblings/nephews", () => {
    const persons = [
      person("root", "Người gốc", { gender: "male", birth_year: 1990 }),
      person("mother", "Mẹ", { gender: "female", birth_year: 1970 }),
      person("grandmother", "Bà ngoại", { gender: "female", birth_year: 1940 }),
      person("great", "Cụ ngoại", { gender: "male" }),
      person("di", "Bà dì", { gender: "female", birth_year: 1950 }),
      person("duong", "Ông dượng", { gender: "male" }),
      person("olderSister", "Chị", { gender: "female", birth_year: 1985 }),
      person("anhRe", "Anh rể", { gender: "male" }),
      person("child", "Con", { gender: "male" }),
      person("grandchild", "Cháu", { gender: "male" }),
      person("daughterInLaw", "Cháu dâu", { gender: "female" }),
    ];
    const relationships = [
      child("mother", "root"),
      child("grandmother", "mother"),
      child("great", "grandmother"),
      child("great", "di"),
      { person_a: "di", person_b: "duong", type: "marriage" },
      child("mother", "olderSister"),
      { person_a: "olderSister", person_b: "anhRe", type: "marriage" },
      child("root", "child"),
      child("child", "grandchild"),
      { person_a: "grandchild", person_b: "daughterInLaw", type: "marriage" },
    ];

    expect(computeKinship(persons[0], persons[5], persons, relationships)?.aCallsB).toBe("ông dượng");
    expect(computeKinship(persons[0], persons[7], persons, relationships)?.aCallsB).toBe("anh rể");
    expect(computeKinship(persons[0], persons[10], persons, relationships)?.aCallsB).toBe("cháu dâu");
  });

  it("calls a son of the younger paternal grand-aunt chú", () => {
    const persons = [
      person("root", "Người gốc", { gender: "male" }),
      person("father", "Cha", { gender: "male" }),
      person("grandfather", "Ông nội", { gender: "male", birth_year: 1940 }),
      person("great", "Cụ nội", { gender: "male" }),
      person("grandAunt", "Bà cô em ông nội", { gender: "female", birth_year: 1950 }),
      person("son", "Con trai bà cô", { gender: "male" }),
    ];
    const relationships = [
      child("father", "root"),
      child("grandfather", "father"),
      child("great", "grandfather"),
      child("great", "grandAunt"),
      child("grandAunt", "son"),
    ];

    expect(computeKinship(persons[0], persons[5], persons, relationships)?.aCallsB).toBe("chú");
  });

});
