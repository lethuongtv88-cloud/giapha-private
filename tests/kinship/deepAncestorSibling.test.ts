import { describe, expect, it } from "vitest";
import { buildRelationshipContext } from "../../utils/kinship/relationshipContext";
import { renderDeepAncestorSiblingTerm } from "../../utils/kinship/rules/deepAncestorSibling";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";

/**
 * Commit 7, Giai đoạn 2 — rule set đời -3, -4 (mục 3.3, bản v3).
 *
 * Trường hợp này (anh chị em ruột của Cố hoặc Sơ) hầu như không xảy ra
 * trong thực tế và KHÔNG có trong dữ liệu demo thật — dùng fixture giả lập.
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

// Chuỗi giả lập: root -> cha -> Ông -> Cố -> Sơ -> (Sơ-cố, common ancestor U=5)
// "Sơ" cố tình đặt giới tính NỮ để test luôn nhánh "qua bà" ở U=5.
const persons: KinshipPersonNode[] = [
  person("root", "Root", { gender: "male" }),
  person("cha", "Cha", { gender: "male" }),
  person("ong", "Ông", { gender: "male", birth_order: 2 }),
  person("co", "Cố", { gender: "male", birth_order: 2 }),
  person("coEmTrai", "Em trai của Cố", { gender: "male", birth_order: 3 }),
  person("coEmGai", "Em gái của Cố", { gender: "female", birth_order: 4 }),
  person("so", "Sơ", { gender: "female", birth_order: 3 }),
  person("soAnhTrai", "Anh của Sơ", { gender: "male", birth_order: 2 }),
  person("soCo", "Sơ-cố", { gender: "male" }),
];

const relationships: KinshipRelationshipEdge[] = [
  child("cha", "root"),
  child("ong", "cha"),
  child("co", "ong"),
  child("so", "co"),
  child("so", "coEmTrai"),
  child("so", "coEmGai"),
  child("soCo", "so"),
  child("soCo", "soAnhTrai"),
];

const byId = new Map(persons.map((p) => [p.id, p]));
function P(id: string): KinshipPersonNode {
  const found = byId.get(id);
  if (!found) throw new Error(`Fixture thiếu người id "${id}"`);
  return found;
}

describe("renderDeepAncestorSiblingTerm — mục 3.3 (đời -3, -4)", () => {
  it("U=4 qua ông, sinh sau Cố -> 'ông chú đời cố'", () => {
    const ctx = buildRelationshipContext(P("root"), P("coEmTrai"), persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDeepAncestorSiblingTerm(ctx!, P("coEmTrai"))).toBe("ông chú đời cố");
  });

  it("U=4 qua ông, em GÁI của Cố -> 'bà cô đời cố'", () => {
    const ctx = buildRelationshipContext(P("root"), P("coEmGai"), persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDeepAncestorSiblingTerm(ctx!, P("coEmGai"))).toBe("bà cô đời cố");
  });

  it("U=5 qua bà (Sơ là nữ), anh của Sơ -> 'ông cậu đời sơ'", () => {
    const ctx = buildRelationshipContext(P("root"), P("soAnhTrai"), persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDeepAncestorSiblingTerm(ctx!, P("soAnhTrai"))).toBe("ông cậu đời sơ");
  });

  it("trả về null với trực hệ (U=2, D=0)", () => {
    const ctx = buildRelationshipContext(P("root"), P("ong"), persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDeepAncestorSiblingTerm(ctx!, P("ong"))).toBeNull();
  });

  it("trả về null khi target không phải chính connector (không phải D=1)", () => {
    const ctx = buildRelationshipContext(P("root"), P("cha"), persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderDeepAncestorSiblingTerm(ctx!, P("cha"))).toBeNull();
  });
});
