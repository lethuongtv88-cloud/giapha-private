import { describe, expect, it } from "vitest";
import { buildRelationshipContext } from "../../utils/kinship/relationshipContext";
import { renderGreatUncleAuntBranchTerm } from "../../utils/kinship/rules/greatUncleAuntBranch";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";
import fixtureRaw from "../fixtures/giapha-export-2026-07-30.json";

/**
 * Commit 13, Giai đoạn 2 — mở rộng mục 3.2 tới D=3 ("Cháu đời 0" — anh/chế/
 * em họ, cùng vai vế root). Dùng fixture mới (137 người, 2026-07-30) vì
 * fixture cũ (106 người) chưa có ai ở đúng độ sâu này.
 *
 * D=3 KHÔNG còn phân biệt nội/ngoại (khác D=1, D=2) — chỉ phụ thuộc nhánh
 * lớn/nhỏ (branchIsElder), theo đúng quy tắc "cả nhánh dùng chung 1 cách
 * xưng hô" ở mục 4 của bản v3.
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

describe("renderGreatUncleAuntBranchTerm — mở rộng D=3 (mục 3.2, anh/chế/em họ)", () => {
  const cases: Array<[string, string]> = [
    // Nhánh lớn (qua bà cô Hạnh, lớn hơn ông nội Đức) — con của Mai Thị Gạo/
    // Mai Văn Khoai/Mai Thị Đậu (đều thuộc cùng nhánh lớn của Hạnh)
    ["Nguyễn Văn Dữ", "anh họ"],
    ["Nguyễn Thi Lan", "chế họ"],
    ["Mai Kiều Oanh", "chế họ"],
    ["Mai Gia Huy", "anh họ"],
    ["Lê Khánh An", "anh họ"],
  ];

  it.each(cases)("Lê Văn Lam -> %s: %s", (targetName, expected) => {
    const root = P("Lê Văn Lam");
    const target = P(targetName);
    const ctx = buildRelationshipContext(root, target, persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderGreatUncleAuntBranchTerm(ctx!, target)).toBe(expected);
  });

  it("nhánh nhỏ (em họ, không phân biệt giới tính) — dữ liệu giả lập vì chưa có trong gia phả thật", () => {
    const p = (id: string, fullName: string, extra: Partial<KinshipPersonNode> = {}): KinshipPersonNode => ({
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

    const synthPersons = [
      p("root", "Root", { gender: "male" }),
      p("cha", "Cha", { gender: "male" }),
      p("ong", "Ông", { gender: "male", birth_order: 2 }),
      p("ongco", "Ông cố", { gender: "male" }),
      p("em", "Em của ông (nhánh nhỏ)", { gender: "male", birth_order: 3 }),
      p("conEm", "Con của em", { gender: "female" }),
      p("chauEm", "Cháu của em (đời 0, nữ)", { gender: "female" }),
    ];
    const synthRelationships: KinshipRelationshipEdge[] = [
      child("cha", "root"),
      child("ong", "cha"),
      child("ongco", "ong"),
      child("ongco", "em"),
      child("em", "conEm"),
      child("conEm", "chauEm"),
    ];

    const ctx = buildRelationshipContext(synthPersons[0], synthPersons[6], synthPersons, synthRelationships);
    expect(ctx).not.toBeNull();
    // "Em họ" không phân biệt giới tính target, khác "Anh/Chế họ" của nhánh lớn.
    expect(renderGreatUncleAuntBranchTerm(ctx!, synthPersons[6])).toBe("em họ");
  });
});
