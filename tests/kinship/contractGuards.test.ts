import { describe, expect, it } from "vitest";
import { computeKinship, type KinshipPersonNode, type KinshipRelationshipEdge } from "../../utils/kinshipHelpers";

/**
 * MODULE 0 — "Hợp đồng ngầm" (contract guards)
 *
 * computeKinship() có 1 kiểu trả về rõ ràng (KinshipResult), nhưng có 2 quy
 * ước KHÔNG nằm trong kiểu dữ liệu mà nhiều nơi khác đang âm thầm dựa vào
 * GIÁ TRỊ CHUỖI cụ thể của aCallsB. Nếu Giai đoạn 2 (rule engine theo
 * he-thong-danh-xung-final-v3.md) đổi các chuỗi này mà không cập nhật đồng
 * bộ, UI sẽ vỡ mà KHÔNG có lỗi biên dịch nào báo trước.
 *
 * File này không kiểm tra "đúng danh xưng" (đã có ở kinshipHelpers.test.ts
 * và kinshipRealData.snapshot.test.ts) — chỉ khoá lại 2 quy ước chuỗi sau:
 *
 * 1. Khi không tìm được đường quan hệ nào (2 người không họ hàng),
 *    aCallsB phải đúng bằng "chưa xác định".
 *    Nơi đang dựa vào chuỗi này: lineageComparison.ts (dòng ~192),
 *    VietnameseFamilyTree.tsx (dòng ~317), centeredCoupleTreeLayout.ts
 *    (dòng ~1076).
 *
 * 2. Khi có đường huyết thống nhưng không map được vào 1 danh xưng cụ thể
 *    (họ hàng xa, ví dụ con cái của 2 nhánh anh em họ khác đời),
 *    aCallsB phải đúng bằng "họ hàng cùng nhánh".
 *    Nơi đang dựa vào chuỗi này: 4 nơi liệt kê trên + inLawAddressing.ts
 *    (GENERIC_LABEL_PATTERNS, dòng ~51).
 *
 * Nếu 1 trong 2 test dưới đây FAIL sau khi sửa rule engine ở Giai đoạn 2,
 * PHẢI cập nhật đồng bộ cả 5 nơi kể trên, không chỉ sửa test này cho qua.
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

describe("computeKinship — hợp đồng ngầm (contract guards cho Giai đoạn 2)", () => {
  it('trả đúng "chưa xác định" khi 2 người hoàn toàn không có quan hệ nào', () => {
    const persons = [
      person("a", "Người A", { gender: "male" }),
      person("b", "Người B (không họ hàng)", { gender: "female" }),
    ];
    const relationships: KinshipRelationshipEdge[] = [];

    const result = computeKinship(persons[0], persons[1], persons, relationships);

    expect(result?.aCallsB).toBe("chưa xác định");
    expect(result?.bCallsA).toBe("chưa xác định");
  });

  it('trả đúng "họ hàng cùng nhánh" khi có đường huyết thống nhưng không map được vào danh xưng cụ thể', () => {
    // 2 người cùng có con chung nhưng KHÔNG phải vợ chồng (không có cạnh
    // marriage). Đường đi ngắn nhất giữa họ là child->parent (qua đứa con
    // chung), không khớp mẫu ông/bà/cô/chú/anh/em nào cả — đây chính là
    // trường hợp genericCollateralTerm() không xử lý được, phải rơi vào
    // nhánh fallback cuối cùng.
    const persons = [
      person("parentA", "Cha (không kết hôn với mẹ)", { gender: "male" }),
      person("parentB", "Mẹ (không kết hôn với cha)", { gender: "female" }),
      person("commonChild", "Con chung", { gender: "male" }),
    ];
    const relationships: KinshipRelationshipEdge[] = [
      child("parentA", "commonChild"),
      child("parentB", "commonChild"),
    ];

    const result = computeKinship(persons[0], persons[1], persons, relationships);

    expect(result?.aCallsB).toBe("họ hàng cùng nhánh");
  });
});
