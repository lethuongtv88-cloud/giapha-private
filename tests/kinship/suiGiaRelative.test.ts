import { describe, expect, it } from "vitest";
import { computeKinship } from "../../utils/kinshipHelpers";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";
import fixtureRaw from "../fixtures/giapha-export-2026-07-30.json";

/**
 * Commit 15, Giai đoạn 2 — Sui gia, họ hàng khác (mục 4 dòng 2-3), PHẠM VI
 * THU GỌN theo thoả thuận với người dùng: thay vì so sánh "vai vế 2 bên"
 * như bản v3 gốc, dùng công thức thực tế:
 *
 *   [danh xưng mục 2-3, XX (con dâu/rể) làm gốc] + " " + ["vợ"|"chồng"] + " " + [tên riêng XX]
 *
 * Chỉ áp dụng khi XX là vợ/chồng của CON RUỘT TRỰC TIẾP của root.
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

describe("computeKinship — sui gia họ hàng khác (mục 4 dòng 2-3, Commit 15)", () => {
  // Trần Thùy Dương là con dâu (vợ của Bách, con trai Lam).
  // Anh chị em ruột của Dương: Trần Anh Đức(2), Trần Thùy Mỵ(3), Trần Anh Hùng(5) — Dương(4).
  const cases: Array<[string, string]> = [
    ["Trần Anh Đức", "anh vợ Dương"],
    ["Trần Thùy Mỵ", "chế vợ Dương"],
    ["Trần Anh Hùng", "em trai vợ Dương"],
  ];

  it.each(cases)("Lê Văn Lam -> %s: %s", (targetName, expected) => {
    const result = computeKinship(P("Lê Văn Lam"), P(targetName), persons, relationships);
    expect(result?.aCallsB).toBe(expected);
  });

  it("KHÔNG đè lên 'Ông sui' (Commit 10 vẫn được ưu tiên trước)", () => {
    const result = computeKinship(P("Lê Văn Lam"), P("Trần Anh Tài"), persons, relationships);
    expect(result?.aCallsB).toBe("ông sui");
  });

  it("KHÔNG đè lên 'con dâu' (Commit 8 vẫn được ưu tiên trước)", () => {
    const result = computeKinship(P("Lê Văn Lam"), P("Trần Thùy Dương"), persons, relationships);
    expect(result?.aCallsB).toBe("con dâu");
  });

  it("chiều 'chồng' (con rể) — dữ liệu giả lập vì gia phả thật chưa có anh chị em của con rể", () => {
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

    const synthPersons = [
      person("root", "Root", { gender: "male" }),
      person("truc", "Con gái Trúc", { gender: "female" }),
      person("vu", "Vũ Thành Tài", { gender: "male", birth_order: 1 }),
      person("vuFather", "Cha của Vũ", { gender: "male" }),
      person("emVu", "Vũ Thị Bích", { gender: "female", birth_order: 2 }),
    ];
    const synthRelationships: KinshipRelationshipEdge[] = [
      child("root", "truc"),
      marriage("truc", "vu"),
      child("vuFather", "vu"),
      child("vuFather", "emVu"),
    ];

    const result = computeKinship(synthPersons[0], synthPersons[4], synthPersons, synthRelationships);
    expect(result?.aCallsB).toBe("em gái chồng Tài");
  });
});
