import { describe, expect, it } from "vitest";
import { buildRelationshipContext } from "../../utils/kinship/relationshipContext";
import { renderImmediateParentSiblingTerm } from "../../utils/kinship/rules/immediateParentSibling";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";
import fixtureRaw from "../fixtures/giapha-demo-2026-07-28.json";

/**
 * Commit 5, Giai đoạn 2 — rule set Bàng hệ tầng liền kề đời -1 (mục 3.1).
 *
 * Toàn bộ case dưới đây đối chiếu với dữ liệu thật: "cô", "chú" đã có sẵn
 * trong Commit 1; "cậu", "dì" là phát hiện thêm (Lý Giàu/Bình/Phát/Châu là
 * anh chị em ruột của Lý Thị Thanh — MẸ của Lê Văn Lam, nên đây đúng là đời
 * -1 cậu/dì thật, dù trước đó dùng root Lê Văn Bách để test mục 3.2 đời -2).
 */

const fixture = fixtureRaw as {
  persons: Array<{
    id: string;
    full_name: string;
    gender: "male" | "female" | "other";
    birth_year: number | null;
    birth_order: number | null;
    generation: number | null;
    is_in_law: boolean;
  }>;
  relationships: Array<{ type: string; person_a: string; person_b: string }>;
};

const persons: KinshipPersonNode[] = fixture.persons.map((p) => ({
  id: p.id,
  full_name: p.full_name,
  gender: p.gender,
  birth_year: p.birth_year,
  birth_order: p.birth_order,
  generation: p.generation,
  is_in_law: p.is_in_law,
}));

const relationships: KinshipRelationshipEdge[] = fixture.relationships.map((r) => ({
  type: r.type,
  person_a: r.person_a,
  person_b: r.person_b,
}));

const byName = new Map<string, KinshipPersonNode>();
for (const p of persons) {
  const key = p.full_name.trim();
  if (!byName.has(key)) byName.set(key, p);
}

function P(fullName: string): KinshipPersonNode {
  const found = byName.get(fullName);
  if (!found) throw new Error(`Fixture thiếu người tên "${fullName}"`);
  return found;
}

const cases: Array<[string, string]> = [
  ["Lê Thị Mai", "cô"], // em gái của cha Phúc
  ["Lê Văn Lộc", "chú"], // em trai của cha Phúc, sinh sau
  ["Lý Giàu", "cậu"], // anh trai của mẹ Lý Thị Thanh
  ["Lý Bình", "dì"], // chị của mẹ
  ["Lý Phát", "cậu"], // em trai của mẹ
  ["Lý Châu", "dì"], // em gái của mẹ
];

describe("renderImmediateParentSiblingTerm — mục 3.1, khớp với dữ liệu thật", () => {
  const root = P("Lê Văn Lam");

  it.each(cases)("Lê Văn Lam -> %s: %s", (targetName, expected) => {
    const target = P(targetName);
    const ctx = buildRelationshipContext(root, target, persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderImmediateParentSiblingTerm(ctx!)).toBe(expected);
  });

  it("trả về null khi không phải đúng U=2,D=1 (ví dụ đời -2 thật sự)", () => {
    const target = P("Lê Thị Hạnh"); // bà cô, U=3 D=1 — không thuộc mục 3.1
    const ctx = buildRelationshipContext(root, target, persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderImmediateParentSiblingTerm(ctx!)).toBeNull();
  });

  it("trả về null khi không phải bàng hệ (ví dụ trực hệ)", () => {
    const target = P("Lê Văn Phúc"); // cha — trực hệ, U=1 D=0
    const ctx = buildRelationshipContext(root, target, persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderImmediateParentSiblingTerm(ctx!)).toBeNull();
  });
});
