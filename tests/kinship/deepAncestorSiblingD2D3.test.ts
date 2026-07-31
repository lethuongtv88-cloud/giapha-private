import { describe, expect, it } from "vitest";
import { buildRelationshipContext } from "../../utils/kinship/relationshipContext";
import { renderDeepAncestorSiblingTerm } from "../../utils/kinship/rules/deepAncestorSibling";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";

/**
 * Commit 14, Giai đoạn 2 — mở rộng mục 3.3 tới D=2, D=3.
 *
 * QUAN TRỌNG: bản v3 chỉ định nghĩa rõ D=1 cho mục 3.3, và nói thẳng D≥2
 * "nằm ngoài phạm vi thực tế cần code chi tiết". D=2/D=3 ở đây là SUY LUẬN
 * MỞ RỘNG (áp lại đúng công thức mục 3.2/Commit 13, cộng hậu tố " đời
 * cố"/" đời sơ") theo yêu cầu người dùng — không phải văn bản gốc.
 *
 * Trường hợp hầu như không xảy ra trong thực tế — toàn bộ dùng fixture giả lập.
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

// root -> cha -> ông -> cố -> sơ (common ancestor U=4)
//   sơ có 2 con: cố (tiếp tục đường root) và "em của cố" (nhánh nhỏ, D=1)
//   "em của cố" có con (D=2) và cháu (D=3)
const persons: KinshipPersonNode[] = [
  person("root", "Root", { gender: "male" }),
  person("cha", "Cha", { gender: "male" }),
  person("ong", "Ông", { gender: "male" }),
  person("co", "Cố", { gender: "male", birth_order: 2 }),
  person("so", "Sơ (tổ tiên chung U=4)", { gender: "male" }),
  person("emCuaCo", "Em của Cố (nhánh nhỏ)", { gender: "male", birth_order: 3 }),
  person("conEmCuaCo", "Con của em Cố (nữ)", { gender: "female" }),
  person("chauEmCuaCo", "Cháu của em Cố — đời 0 (nam)", { gender: "male" }),
];

const relationships: KinshipRelationshipEdge[] = [
  child("cha", "root"),
  child("ong", "cha"),
  child("co", "ong"),
  child("so", "co"),
  child("so", "emCuaCo"),
  child("emCuaCo", "conEmCuaCo"),
  child("conEmCuaCo", "chauEmCuaCo"),
];

const byId = new Map(persons.map((p) => [p.id, p]));
function P(id: string): KinshipPersonNode {
  const found = byId.get(id);
  if (!found) throw new Error(`Fixture thiếu người id "${id}"`);
  return found;
}

describe("renderDeepAncestorSiblingTerm — mở rộng D=2, D=3 (mục 3.3)", () => {
  it("D=1 (đã có từ Commit 7): 'ông chú đời cố'", () => {
    const ctx = buildRelationshipContext(P("root"), P("emCuaCo"), persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDeepAncestorSiblingTerm(ctx!, P("emCuaCo"))).toBe("ông chú đời cố");
  });

  it("D=2 (mở rộng mới): con của 'ông chú đời cố' (nữ, nhánh nhỏ) -> 'cô đời cố'", () => {
    const ctx = buildRelationshipContext(P("root"), P("conEmCuaCo"), persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDeepAncestorSiblingTerm(ctx!, P("conEmCuaCo"))).toBe("cô đời cố");
  });

  it("D=3 (mở rộng mới): cháu của 'ông chú đời cố' (nam, nhánh nhỏ) -> 'em họ đời cố'", () => {
    const ctx = buildRelationshipContext(P("root"), P("chauEmCuaCo"), persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDeepAncestorSiblingTerm(ctx!, P("chauEmCuaCo"))).toBe("em họ đời cố");
  });
});
