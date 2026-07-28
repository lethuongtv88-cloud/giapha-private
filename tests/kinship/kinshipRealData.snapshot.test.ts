import { describe, expect, it } from "vitest";
import { computeKinship, type KinshipPersonNode, type KinshipRelationshipEdge } from "../../utils/kinshipHelpers";
import fixtureRaw from "../fixtures/giapha-demo-2026-07-28.json";

/**
 * Snapshot test dựa trên cây gia phả DEMO đầy đủ (106 người, không phải dữ
 * liệu thật của gia đình nào) do người dùng cung cấp ngày 2026-07-28.
 *
 * MỤC ĐÍCH: khoá lại hành vi HIỆN TẠI của computeKinship() để làm lưới an
 * toàn cho việc refactor V2 (hệ thống danh xưng theo he-thong-danh-xung-final-v3.md)
 * sắp tới. Đây KHÔNG phải bài test "đúng theo v3 hay chưa" — một vài case bên
 * dưới cố tình khoá lại kết quả biết là sẽ đổi khi V2 hoàn thành, xem cột
 * ghi chú "[SẼ ĐỔI KHI V2]".
 *
 * Không test getInLawAddressDetail() (con dâu/rể, sui gia) ở đây — hàm đó
 * cần dựng thêm ngữ cảnh side/branch/generation, để dành cho 1 commit riêng.
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

function personByName(fullName: string): KinshipPersonNode {
  const found = byName.get(fullName);
  if (!found) throw new Error(`Fixture thiếu người tên "${fullName}" — kiểm tra lại file fixture JSON.`);
  return found;
}

// [rootName, targetName, mô tả quan hệ, aCallsB kỳ vọng, bCallsA kỳ vọng]
const cases: Array<[string, string, string, string, string]> = [
  // --- Trực hệ lên (từ Lê Văn Lam) ---
  ["Lê Văn Lam", "Lê Văn Phúc", "cha", "cha", "con trai"],
  ["Lê Văn Lam", "Lê Văn Đức", "ông nội", "ông nội", "cháu nội"],
  ["Lê Văn Lam", "Lê Văn Phước", "ông cố", "ông cố bên nội", "chắt"],

  // --- Trực hệ xuống đủ 5 mức (từ tổ tiên gốc Lê Văn Phước) ---
  ["Lê Văn Phước", "Lê Văn Đức", "con trai", "con trai", "cha"],
  ["Lê Văn Phước", "Lê Văn Phúc", "cháu nội", "cháu nội", "ông nội"],
  ["Lê Văn Phước", "Lê Văn Lam", "chắt", "chắt", "ông cố bên nội"],
  ["Lê Văn Phước", "Lê Văn Bách", "chút", "chút", "ông sơ bên nội"],
  ["Lê Văn Phước", "Lê Thị Sương", "chít", "chít", "Cha Ông sơ bên nội"],

  // --- Anh chị em ruột đời 0 (các con khác của Lê Văn Phúc) ---
  ["Lê Văn Lam", "Lê Thị Hồng", "chị/chế ruột (thứ 2 vs thứ 4)", "chế", "em trai"],
  ["Lê Văn Lam", "Lê Văn Cam", "anh ruột (thứ 3 vs thứ 4)", "anh", "em trai"],
  ["Lê Văn Lam", "Lê Thị Vàng", "em gái ruột (thứ 5 vs thứ 4)", "em gái", "anh"],
  ["Lê Văn Lam", "Lê Văn Lục", "em trai ruột (thứ 6 vs thứ 4)", "em trai", "anh"],

  // --- Đời -1: anh chị em ruột của cha (con khác của ông nội Lê Văn Đức) ---
  ["Lê Văn Lam", "Lê Thị Mai", "cô (em gái của cha)", "cô", "cháu"],
  ["Lê Văn Lam", "Lê Văn Lộc", "chú (em trai của cha)", "chú", "cháu"],

  // --- Đời -2 Nhánh A/B/C: anh chị em ruột của ông nội (con khác của Lê Văn Phước) ---
  ["Lê Văn Lam", "Lê Thị Hạnh", "bà cô — chị của ông nội (thứ 2 vs thứ 3)", "bà cô", "cháu"],
  ["Lê Văn Lam", "Mai Thị Gạo", "cô — con gái của bà cô LỚN hơn ông nội", "cô", "cháu"],
  ["Lê Văn Lam", "Mai Văn Khoai", "bác — con trai của bà cô LỚN hơn ông nội", "bác", "cháu"],
  ["Lê Văn Lam", "Lê Văn Khang", "ông chú — em trai của ông nội (cùng thứ 3, xếp sau)", "ông chú", "cháu"],

  // --- Đời -2 Nhánh D/E (qua bà): anh chị em ruột của bà nội ---
  // Root đổi sang Lê Văn Bách (con của Lam) vì lúc đó Lý Thị Thanh mới đúng là BÀ NỘI.
  ["Lê Văn Bách", "Lý Thị Thanh", "bà nội", "bà nội", "cháu nội"],
  ["Lê Văn Bách", "Lý Giàu", "ông cậu nhánh lớn (anh của bà, thứ 2 vs thứ 4)", "ông cậu", "cháu"],
  ["Lê Văn Bách", "Lý Bình", "bà dì nhánh lớn (chị của bà)", "bà dì", "cháu"],
  ["Lê Văn Bách", "Lý Phát", "ông cậu nhánh nhỏ (em của bà, thứ 5 vs thứ 4)", "ông cậu", "cháu"],
  ["Lê Văn Bách", "Lý Châu", "bà dì nhánh nhỏ (em của bà)", "bà dì", "cháu"],
  // [SẼ ĐỔI KHI V2] Theo bản v3 (Nhánh D nhánh nhỏ/ngoại), con của ông cậu nhánh
  // nhỏ nên gọi "cậu", không phải "chú". Khoá lại hành vi HIỆN TẠI ở đây.
  ["Lê Văn Bách", "Lý Lập", "[SẼ ĐỔI KHI V2] con trai của ông cậu nhánh nhỏ", "chú", "cháu"],
  ["Lê Văn Bách", "Lý Giao", "[SẼ ĐỔI KHI V2] con gái NUÔI của ông cậu nhánh nhỏ", "cô", "cháu"],

  // --- Con nuôi (adopted_child) ---
  ["Lý Phát", "Lý Giao", "cha nuôi -> con nuôi, 1 bước trực tiếp", "con gái", "cha"],

  // --- Cháu ngoại (qua con gái) ---
  ["Lê Văn Lam", "Trần Bình", "cháu ngoại (con của con gái Lê Thị Huệ)", "cháu ngoại", "ông ngoại"],
];

describe("computeKinship — snapshot trên cây gia phả demo (106 người, 2026-07-28)", () => {
  it.each(cases)("%s -> %s: %s", (rootName, targetName, _label, expectedACallsB, expectedBCallsA) => {
    const root = personByName(rootName);
    const target = personByName(targetName);

    const result = computeKinship(root, target, persons, relationships);

    expect(result?.aCallsB).toBe(expectedACallsB);
    expect(result?.bCallsA).toBe(expectedBCallsA);
  });
});
