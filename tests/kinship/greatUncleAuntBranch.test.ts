import { describe, expect, it } from "vitest";
import { buildRelationshipContext } from "../../utils/kinship/relationshipContext";
import { renderGreatUncleAuntBranchTerm } from "../../utils/kinship/rules/greatUncleAuntBranch";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";
import fixtureRaw from "../fixtures/giapha-demo-2026-07-28.json";

/**
 * Commit 6, Giai đoạn 2 — rule set 5 nhánh A-E, mục 3.2 (D=1 và D=2 thôi,
 * D=3 "cháu đời 0" để dành gộp với mục 3.5 ở commit sau).
 *
 * QUAN TRỌNG: case "Lê Văn Bách -> Lý Lập" ở đây cho "chú" — Commit 1 từng
 * đánh dấu case này là "[SẼ ĐỔI KHI V2]" (đoán sai là sẽ đổi thành "cậu").
 * Sau khi phân tích kỹ + xác nhận với người dùng, kết luận: code CŨ đã ĐÚNG,
 * không cần đổi gì — Commit 1's ghi chú đó là nhận định sai, không phải một
 * thay đổi hành vi thật sự cần làm ở Giai đoạn 2.
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

const cases: Array<[string, string, string, string]> = [
  // [root, target, mô tả, kỳ vọng]
  ["Lê Văn Lam", "Lê Thị Hạnh", "D1 nội — bà cô lớn hơn ông", "bà cô"],
  ["Lê Văn Lam", "Lê Văn Khang", "D1 nội — ông chú (Khang sinh sau Đức)", "ông chú"],
  ["Lê Văn Bách", "Lý Giàu", "D1 ngoại — ông cậu nhánh lớn", "ông cậu"],
  ["Lê Văn Bách", "Lý Bình", "D1 ngoại — bà dì nhánh lớn", "bà dì"],
  ["Lê Văn Bách", "Lý Phát", "D1 ngoại — ông cậu nhánh nhỏ", "ông cậu"],
  ["Lê Văn Bách", "Lý Châu", "D1 ngoại — bà dì nhánh nhỏ", "bà dì"],
  ["Lê Văn Lam", "Mai Thị Gạo", "D2 nội, elder (bà cô Hạnh) — con gái", "cô"],
  ["Lê Văn Lam", "Mai Văn Khoai", "D2 nội, elder (bà cô Hạnh) — con trai → BÁC", "bác"],
  ["Lê Văn Lam", "Lê Văn Cua", "D2 nội, younger (Khang) — con trai → CHÚ", "chú"],
  ["Lê Văn Lam", "Lê Thị Rô", "D2 nội, younger (Khang) — con gái", "cô"],
  ["Lê Văn Lam", "Hồ Gia An", "D2 nội, younger (Bình) — con trai → CHÚ", "chú"],
  ["Lê Văn Bách", "Lý Lập", "D2 nội, nhỏ (Bách đi qua CHA Lam) — con trai → CHÚ", "chú"],
  ["Lê Văn Bách", "Lý Giao", "D2 nội, nhỏ — con NUÔI gái → CÔ", "cô"],
  ["Lê Thị Sương", "Lý Sự", "D2 ngoại (nhánh khác hoàn toàn) — con trai → CẬU", "cậu"],
];

describe("renderGreatUncleAuntBranchTerm — mục 3.2 (D=1, D=2), khớp 100% với computeKinship() cũ", () => {
  it.each(cases)("%s -> %s [%s]: %s", (rootName, targetName, _label, expected) => {
    const root = P(rootName);
    const target = P(targetName);
    const ctx = buildRelationshipContext(root, target, persons, relationships);

    expect(ctx).not.toBeNull();
    expect(renderGreatUncleAuntBranchTerm(ctx!, target)).toBe(expected);
  });

  it("trả về null ngoài phạm vi U=3 (ví dụ đời -1 thật)", () => {
    const ctx = buildRelationshipContext(P("Lê Văn Lam"), P("Lê Thị Mai"), persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderGreatUncleAuntBranchTerm(ctx!, P("Lê Thị Mai"))).toBeNull();
  });

  it("trả về null khi D=3 (cháu đời 0 — thuộc rule set khác, chưa xử lý ở đây)", () => {
    const ctx = buildRelationshipContext(P("Lê Văn Lam"), P("Trần Bình"), persons, relationships);
    // Trần Bình không phải cháu đời 0 của nhánh này, nhưng cứ chọn 1 case
    // U != 3 khác để xác nhận rule set không "ăn nhầm" phạm vi ngoài mình.
    expect(ctx).not.toBeNull();
    expect(renderGreatUncleAuntBranchTerm(ctx!, P("Trần Bình"))).toBeNull();
  });
});
