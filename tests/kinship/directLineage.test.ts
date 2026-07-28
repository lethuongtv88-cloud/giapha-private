import { describe, expect, it } from "vitest";
import { buildRelationshipContext } from "../../utils/kinship/relationshipContext";
import { renderDirectLineageTerm } from "../../utils/kinship/rules/directLineage";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";
import fixtureRaw from "../fixtures/giapha-demo-2026-07-28.json";

/**
 * Commit 4, Giai đoạn 2 — rule set Trực hệ (mục 2, bản v3).
 *
 * Toàn bộ case dưới đây LẤY THẲNG từ 8 case trực hệ đã có trong
 * kinshipRealData.snapshot.test.ts (Commit 1) — mục 2 không có gì thay đổi
 * so với hành vi hiện tại, nên renderDirectLineageTerm() PHẢI cho ra đúng
 * y hệt các chuỗi đã khoá ở Commit 1.
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

// [root, target, aCallsB kỳ vọng — copy nguyên văn từ Commit 1]
const cases: Array<[string, string, string]> = [
  ["Lê Văn Lam", "Lê Văn Phúc", "cha"],
  ["Lê Văn Lam", "Lê Văn Đức", "ông nội"],
  ["Lê Văn Lam", "Lê Văn Phước", "ông cố bên nội"],
  ["Lê Văn Phước", "Lê Văn Đức", "con trai"],
  ["Lê Văn Phước", "Lê Văn Phúc", "cháu nội"],
  ["Lê Văn Phước", "Lê Văn Lam", "chắt"],
  ["Lê Văn Phước", "Lê Văn Bách", "chút"],
  ["Lê Văn Phước", "Lê Thị Sương", "chít"],
];

describe("renderDirectLineageTerm — khớp 100% với 8 case trực hệ ở Commit 1", () => {
  it.each(cases)("%s -> %s: %s", (rootName, targetName, expected) => {
    const root = P(rootName);
    const target = P(targetName);
    const ctx = buildRelationshipContext(root, target, persons, relationships);

    expect(ctx).not.toBeNull();
    expect(renderDirectLineageTerm(ctx!, target)).toBe(expected);
  });

  it("case đời -5 (chưa có trong dữ liệu thật): 'Cha Ông sơ bên nội', khớp bCallsA cũ của Phước<->Sương", () => {
    // bCallsA của cặp Phước<->Sương trong Commit 1 là "Cha Ông sơ bên nội"
    // (Sương gọi Phước) — đây là chiều ASCEND (Sương leo lên Phước, 5 đời).
    const root = P("Lê Thị Sương");
    const target = P("Lê Văn Phước");
    const ctx = buildRelationshipContext(root, target, persons, relationships);

    expect(ctx).not.toBeNull();
    expect(renderDirectLineageTerm(ctx!, target)).toBe("Cha Ông sơ bên nội");
  });

  it("trả về null khi không phải trực hệ thuần (có rẽ nhánh)", () => {
    const root = P("Lê Văn Lam");
    const target = P("Lê Thị Mai"); // cô — bàng hệ, không thuộc mục 2
    const ctx = buildRelationshipContext(root, target, persons, relationships);

    expect(ctx).not.toBeNull();
    expect(renderDirectLineageTerm(ctx!, target)).toBeNull();
  });

  it("trả về null khi là vợ/chồng thuần (không thuộc mục 2)", () => {
    const root = P("Lê Văn Lam");
    const target = P("Nguyễn Thị Hoa");
    const ctx = buildRelationshipContext(root, target, persons, relationships);

    expect(ctx).not.toBeNull();
    expect(renderDirectLineageTerm(ctx!, target)).toBeNull();
  });
});
