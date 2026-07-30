import { describe, expect, it } from "vitest";
import { buildRelationshipContext } from "../../utils/kinship/relationshipContext";
import {
  renderChildOrGrandchildInLawTerm,
  renderNiblingTerm,
  renderSiblingTerm,
} from "../../utils/kinship/rules/siblingAndChildInLaw";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";
import fixtureRaw from "../fixtures/giapha-demo-2026-07-28.json";

/**
 * Commit 8, Giai đoạn 2 — rule set Đời 0 (mục 3.5) + Đời +1,+2 (mục 3.6).
 *
 * Con dâu/con rể chỉ hoạt động đúng SAU Commit 8a (fix rút gọn đường vòng
 * qua con chung) — nếu 2 test đó fail, kiểm tra lại Commit 8a đã áp dụng
 * đúng vào utils/kinshipHelpers.ts chưa.
 *
 * "Cháu dâu/cháu rể" không có trong dữ liệu demo thật (chưa ai trong đời
 * cháu của Lam lập gia đình) — dùng fixture giả lập riêng cho 2 case đó.
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

describe("renderSiblingTerm — mục 3.5 (đời 0)", () => {
  const cases: Array<[string, string]> = [
    ["Lê Thị Hồng", "chế"],
    ["Lê Văn Cam", "anh"],
    ["Lê Thị Vàng", "em gái"],
    ["Lê Văn Lục", "em trai"],
  ];

  it.each(cases)("Lê Văn Lam -> %s: %s", (targetName, expected) => {
    const root = P("Lê Văn Lam");
    const target = P(targetName);
    const ctx = buildRelationshipContext(root, target, persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderSiblingTerm(ctx!, target)).toBe(expected);
  });
});

describe("renderNiblingTerm — mục 3.6, con của anh chị em ruột", () => {
  it("Lê Văn Lam -> Lê Văn Bích (con của em trai Lục): cháu", () => {
    const root = P("Lê Văn Lam");
    const target = P("Lê Văn Bích");
    const ctx = buildRelationshipContext(root, target, persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderNiblingTerm(ctx!)).toBe("cháu");
  });
});

describe("renderChildOrGrandchildInLawTerm — mục 3.6, dâu/rể", () => {
  it("Lê Văn Lam -> Trần Thùy Dương (vợ của con trai Tùng): con dâu", () => {
    const root = P("Lê Văn Lam");
    const target = P("Trần Thùy Dương");
    const ctx = buildRelationshipContext(root, target, persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderChildOrGrandchildInLawTerm(ctx!)).toBe("con dâu");
  });

  it("Lê Văn Lam -> Vũ Văn Vũ (chồng của con gái Trúc): con rể", () => {
    const root = P("Lê Văn Lam");
    const target = P("Vũ Văn Vũ");
    const ctx = buildRelationshipContext(root, target, persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderChildOrGrandchildInLawTerm(ctx!)).toBe("con rể");
  });

  it("cháu dâu (dữ liệu giả lập — không có trong gia phả thật)", () => {
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
    const syntheticPersons = [
      p("root", "Root", { gender: "male" }),
      p("son", "Con trai", { gender: "male" }),
      p("grandson", "Cháu trai", { gender: "male" }),
      p("grandsonWife", "Vợ cháu trai", { gender: "female" }),
    ];
    const syntheticRelationships: KinshipRelationshipEdge[] = [
      { person_a: "root", person_b: "son", type: "biological_child" },
      { person_a: "son", person_b: "grandson", type: "biological_child" },
      { person_a: "grandson", person_b: "grandsonWife", type: "marriage" },
    ];

    const ctx = buildRelationshipContext(
      syntheticPersons[0],
      syntheticPersons[3],
      syntheticPersons,
      syntheticRelationships,
    );
    expect(ctx).not.toBeNull();
    expect(renderChildOrGrandchildInLawTerm(ctx!)).toBe("cháu dâu");
  });
});
