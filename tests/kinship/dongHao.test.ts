import { describe, expect, it } from "vitest";
import { computeKinship } from "../../utils/kinshipHelpers";
import { buildRelationshipContext } from "../../utils/kinship/relationshipContext";
import { renderDongHaoTerm } from "../../utils/kinship/rules/dongHao";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";

/**
 * Commit 9, Giai đoạn 2 — rule set Đồng hao (mục 3.4, bản v3).
 *
 * "Cột chèo" (2 rể của 2 chị em ruột) đối chiếu trực tiếp với dongHaoTerm()
 * cũ (đã có sẵn trong computeKinship() từ trước, kiểm tra ở test 13 gốc).
 * "Chị em bạn dâu" (2 dâu của 2 anh em ruột) dùng fixture riêng vì đối
 * xứng logic, không cần đối chiếu lại code cũ.
 */

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

const marriage = (a: string, b: string): KinshipRelationshipEdge => ({
  person_a: a,
  person_b: b,
  type: "marriage",
});

describe("renderDongHaoTerm — cột chèo (mục 3.4)", () => {
  const persons = [
    person("root", "Người gốc", { gender: "male" }),
    person("wife", "Vợ", { gender: "female", birth_year: 1990 }),
    person("wifeOlderSister", "Chị vợ", { gender: "female", birth_year: 1985 }),
    person("brotherInLaw", "Anh cột chèo", { gender: "male" }),
    person("father", "Cha vợ", { gender: "male" }),
    person("mother", "Mẹ vợ", { gender: "female" }),
  ];
  const relationships: KinshipRelationshipEdge[] = [
    marriage("root", "wife"),
    child("father", "wife"),
    child("mother", "wife"),
    child("father", "wifeOlderSister"),
    child("mother", "wifeOlderSister"),
    marriage("wifeOlderSister", "brotherInLaw"),
  ];

  it("khớp với computeKinship() cũ (dongHaoTerm sẵn có): root -> anh cột chèo => em cột chèo", () => {
    const oldResult = computeKinship(persons[0], persons[3], persons, relationships);
    expect(oldResult?.aCallsB).toBe("em cột chèo");

    const ctx = buildRelationshipContext(persons[0], persons[3], persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDongHaoTerm(ctx!, persons[0], persons[3])).toBe("em cột chèo");
  });

  it("chiều ngược lại: anh cột chèo -> root => anh cột chèo", () => {
    const oldResult = computeKinship(persons[3], persons[0], persons, relationships);
    expect(oldResult?.aCallsB).toBe("anh cột chèo");

    const ctx = buildRelationshipContext(persons[3], persons[0], persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDongHaoTerm(ctx!, persons[3], persons[0])).toBe("anh cột chèo");
  });
});

describe("renderDongHaoTerm — chị em bạn dâu (mục 3.4)", () => {
  const persons = [
    person("root", "Người gốc", { gender: "female" }),
    person("husband", "Chồng (anh)", { gender: "male", birth_order: 2 }),
    person("husbandYoungerBrother", "Em chồng", { gender: "male", birth_order: 3 }),
    person("target", "Bạn dâu", { gender: "female" }),
    person("father", "Cha chồng", { gender: "male" }),
  ];
  const relationships: KinshipRelationshipEdge[] = [
    marriage("root", "husband"),
    child("father", "husband"),
    child("father", "husbandYoungerBrother"),
    marriage("husbandYoungerBrother", "target"),
  ];

  it("chồng root là anh -> gọi bạn dâu là 'chế bạn dâu'", () => {
    const ctx = buildRelationshipContext(persons[0], persons[3], persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDongHaoTerm(ctx!, persons[0], persons[3])).toBe("chế bạn dâu");
  });

  it("chiều ngược lại -> 'em bạn dâu'", () => {
    const ctx = buildRelationshipContext(persons[3], persons[0], persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDongHaoTerm(ctx!, persons[3], persons[0])).toBe("em bạn dâu");
  });
});

describe("renderDongHaoTerm — guard: không áp dụng ngoài phạm vi", () => {
  it("trả về null khi khác giới tính", () => {
    const persons = [
      person("root", "Root", { gender: "male" }),
      person("target", "Target", { gender: "female" }),
      person("wife", "Vợ root", { gender: "female", birth_year: 1990 }),
      person("husband", "Chồng target", { gender: "male", birth_year: 1985 }),
      person("father", "Cha chung", { gender: "male" }),
    ];
    const relationships: KinshipRelationshipEdge[] = [
      marriage("root", "wife"),
      child("father", "wife"),
      child("father", "husband"),
      marriage("husband", "target"),
    ];
    const ctx = buildRelationshipContext(persons[0], persons[1], persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDongHaoTerm(ctx!, persons[0], persons[1])).toBeNull();
  });
});
