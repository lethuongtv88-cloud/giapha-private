import { describe, expect, it } from "vitest";
import { computeKinship, getRelationshipPath, type KinshipPersonNode, type KinshipRelationshipEdge } from "../../utils/kinshipHelpers";

/**
 * Commit 8a — fix "đường vòng qua con chung" khi tìm quan hệ vợ/chồng không
 * nối trực tiếp (khác Commit 0: Commit 0 chỉ fix khi 2 người CÓ cạnh nối
 * trực tiếp; đây là trường hợp phải đi qua trung gian, ví dụ "con dâu" —
 * root không nối trực tiếp với vợ của con trai mình).
 *
 * Trước khi sửa: root -> con trai -> CHÁU (con chung) -> mẹ của cháu, bị
 * chọn thay vì root -> con trai -> vợ (trực tiếp), vì đường qua cháu "rẻ"
 * hơn theo trọng số (3 điểm so với 5 điểm).
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

describe("Commit 8a — rút gọn đường vòng qua con chung khi có cạnh vợ/chồng trực tiếp", () => {
  it("con dâu: root -> con trai -> vợ (KHÔNG đi vòng qua cháu chung)", () => {
    const persons = [
      person("root", "Root", { gender: "male" }),
      person("son", "Con trai", { gender: "male" }),
      person("wife", "Vợ của con trai", { gender: "female" }),
      person("grandchild", "Cháu (con chung của Con trai và Vợ)", { gender: "male" }),
    ];
    const relationships: KinshipRelationshipEdge[] = [
      child("root", "son"),
      marriage("son", "wife"),
      child("son", "grandchild"),
      child("wife", "grandchild"),
    ];

    const path = getRelationshipPath(persons[0], persons[2], persons, relationships);
    expect(path?.steps).toEqual(["child", "spouse"]);
    expect(path?.people.map((p) => p.id)).toEqual(["root", "son", "wife"]);

    const result = computeKinship(persons[0], persons[2], persons, relationships);
    expect(result?.aCallsB).toBe("con dâu");
  });

  it("KHÔNG rút gọn khi 2 người có con chung nhưng KHÔNG kết hôn (giữ đúng hành vi Module 0)", () => {
    const persons = [
      person("pa", "Cha (không kết hôn với mẹ)", { gender: "male" }),
      person("pb", "Mẹ (không kết hôn với cha)", { gender: "female" }),
      person("c", "Con chung", { gender: "male" }),
    ];
    const relationships: KinshipRelationshipEdge[] = [child("pa", "c"), child("pb", "c")];

    const result = computeKinship(persons[0], persons[1], persons, relationships);
    expect(result?.aCallsB).toBe("họ hàng cùng nhánh");
  });

  it("vẫn đúng khi 2 người nối trực tiếp và có con chung (không hồi quy Commit 0)", () => {
    const persons = [
      person("husband", "Chồng", { gender: "male" }),
      person("wife", "Vợ", { gender: "female" }),
      person("child", "Con chung", { gender: "male" }),
    ];
    const relationships: KinshipRelationshipEdge[] = [
      marriage("husband", "wife"),
      child("husband", "child"),
      child("wife", "child"),
    ];

    const result = computeKinship(persons[0], persons[1], persons, relationships);
    expect(result?.aCallsB).toBe("vợ");
  });
});
