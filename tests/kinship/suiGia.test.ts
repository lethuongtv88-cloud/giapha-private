import { describe, expect, it } from "vitest";
import { computeKinship } from "../../utils/kinshipHelpers";
import { renderSuiGiaTerm } from "../../utils/kinship/rules/suiGia";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";
import fixtureRaw from "../fixtures/giapha-demo-2026-07-28.json";

/**
 * Commit 10, Giai đoạn 2 — rule set Sui gia, mục 4 DÒNG 1 (Ông sui/Bà sui).
 *
 * Chưa xử lý dòng 2-3 của mục 4 (họ hàng khác của 2 bên sui gia) — để dành
 * commit riêng nếu cần, vì đòi hỏi tính vai vế độc lập ở cả 2 nhà.
 *
 * Đối chiếu trực tiếp với computeKinship() cũ (đã có sẵn nhận diện "ông
 * sui"/"bà sui" từ trước) trên dữ liệu thật.
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

describe("renderSuiGiaTerm — mục 4, dòng 1 (Ông sui/Bà sui)", () => {
  it("Lê Văn Lam -> Trần Anh Tài (cha của con dâu Trần Thùy Dương): ông sui, khớp code cũ", () => {
    const root = P("Lê Văn Lam");
    const target = P("Trần Anh Tài");

    const oldResult = computeKinship(root, target, persons, relationships);
    expect(oldResult?.aCallsB).toBe("ông sui");

    expect(renderSuiGiaTerm(root, target, persons, relationships)).toBe("ông sui");
  });

  it("Lê Văn Lam -> Lý Ngọc Châu (mẹ của con dâu): bà sui, khớp code cũ", () => {
    const root = P("Lê Văn Lam");
    const target = P("Lý Ngọc Châu");

    const oldResult = computeKinship(root, target, persons, relationships);
    expect(oldResult?.aCallsB).toBe("bà sui");

    expect(renderSuiGiaTerm(root, target, persons, relationships)).toBe("bà sui");
  });

  it("trả về null khi target là cha ruột của root (không phải sui gia)", () => {
    const root = P("Lê Văn Lam");
    const target = P("Lê Văn Phúc");
    expect(renderSuiGiaTerm(root, target, persons, relationships)).toBeNull();
  });

  it("trả về null khi 2 người không có quan hệ nào", () => {
    const root = P("Lê Văn Lam");
    const target = persons.find((p) => p.full_name.includes("Danh Thị Hồng Hà")) ?? P("Lê Văn Lam");
    if (target.id === root.id) return; // bỏ qua nếu fixture không có người này
    expect(renderSuiGiaTerm(root, target, persons, relationships)).toBeNull();
  });
});
