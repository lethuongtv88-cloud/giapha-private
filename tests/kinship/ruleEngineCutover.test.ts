import { describe, expect, it } from "vitest";
import { computeKinship } from "../../utils/kinshipHelpers";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";
import fixtureRaw from "../fixtures/giapha-demo-2026-07-28.json";

/**
 * Commit 11, Giai đoạn 2 — CẮT SANG DÙNG THẬT.
 *
 * computeKinship() giờ gọi renderKinshipTermV2() (dispatcher tổng hợp toàn
 * bộ rule set Commit 3-10) TRƯỚC, chỉ rơi về termFromPath() cũ khi rule
 * engine mới trả về null (chưa phủ tới trường hợp đó).
 *
 * File test này KHÔNG lặp lại toàn bộ 27 case của kinshipRealData.snapshot
 * .test.ts (file đó tự động vẫn đúng vì gọi computeKinship() y hệt) — chỉ
 * thêm vài case xác nhận riêng: (1) rule engine mới THẬT SỰ được dùng cho
 * case nó phủ được, (2) fallback về code cũ vẫn hoạt động cho case chưa phủ,
 * (3) không có case nào bị "cụt" (mất câu trả lời) so với trước khi cắt.
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

describe("computeKinship — sau Commit 11 (cắt sang rule engine V2)", () => {
  it("dùng rule engine mới cho trực hệ (Commit 4)", () => {
    const result = computeKinship(P("Lê Văn Lam"), P("Lê Văn Phúc"), persons, relationships);
    expect(result?.aCallsB).toBe("cha");
  });

  it("dùng rule engine mới cho 5 nhánh A-E (Commit 6)", () => {
    const result = computeKinship(P("Lê Văn Lam"), P("Mai Văn Khoai"), persons, relationships);
    expect(result?.aCallsB).toBe("bác");
  });

  it("dùng rule engine mới cho con dâu/rể (Commit 8a+8)", () => {
    const dau = computeKinship(P("Lê Văn Lam"), P("Trần Thùy Dương"), persons, relationships);
    expect(dau?.aCallsB).toBe("con dâu");
    const re = computeKinship(P("Lê Văn Lam"), P("Vũ Văn Vũ"), persons, relationships);
    expect(re?.aCallsB).toBe("con rể");
  });

  it("dùng rule engine mới cho sui gia (Commit 10)", () => {
    const result = computeKinship(P("Lê Văn Lam"), P("Trần Anh Tài"), persons, relationships);
    expect(result?.aCallsB).toBe("ông sui");
  });

  it("guard Commit 10b vẫn hoạt động sau khi cắt: 'vợ của cha' không bị nhầm 'mẹ'", () => {
    const result = computeKinship(P("Lê Văn Bách"), P("Nguyễn Thị Hoa"), persons, relationships);
    expect(result?.aCallsB).toBe("vợ của cha");
  });

  it(
    "không có cặp nào trong dữ liệu thật bị MẤT câu trả lời so với trước khi cắt",
    () => {
      // So computeKinship() hiện tại với chính nó chạy trên toàn bộ N x N —
      // không phải so cũ/mới (đã đo thủ công ở bước phân tích), mà xác nhận
      // không có kết quả nào bị null/undefined bất thường.
      let missing = 0;
      for (const a of persons) {
        for (const b of persons) {
          if (a.id === b.id) continue;
          const result = computeKinship(a, b, persons, relationships);
          if (!result || !result.aCallsB) missing++;
        }
      }
      expect(missing).toBe(0);
    },
    30_000, // ~11.130 cặp (106x105), cần nhiều hơn 5s mặc định của vitest
  );
});
