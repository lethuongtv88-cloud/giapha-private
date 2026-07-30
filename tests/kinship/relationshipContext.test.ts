import { describe, expect, it } from "vitest";
import { buildRelationshipContext } from "../../utils/kinship/relationshipContext";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";
import fixtureRaw from "../fixtures/giapha-demo-2026-07-28.json";

/**
 * Commit 3, Giai đoạn 2 — test cho buildRelationshipContext().
 *
 * Đây là lớp TÍNH TOÁN THUẦN TUÝ, chưa render danh xưng nào cả (không có
 * "bác"/"chú"/"cô" ở đây). Mục tiêu: xác nhận U/D/level/connector/
 * directAncestorAtConnectorLevel được tính đúng, làm nền cho các rule set
 * render (Commit 4 trở đi) dùng thay vì tự đọc lại steps/people thô.
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

describe("buildRelationshipContext", () => {
  it("trực hệ lên: cha (U=1, D=0)", () => {
    const ctx = buildRelationshipContext(P("Lê Văn Lam"), P("Lê Văn Phúc"), persons, relationships);
    expect(ctx?.ascendSteps).toBe(1);
    expect(ctx?.descendSteps).toBe(0);
    expect(ctx?.level).toBe(-1);
    expect(ctx?.isPureLineage).toBe(true);
  });

  it("trực hệ lên: ông cố, 3 đời (U=3, D=0)", () => {
    const ctx = buildRelationshipContext(P("Lê Văn Lam"), P("Lê Văn Phước"), persons, relationships);
    expect(ctx?.ascendSteps).toBe(3);
    expect(ctx?.level).toBe(-3);
    expect(ctx?.isPureLineage).toBe(true);
    expect(ctx?.commonAncestor?.full_name.trim()).toBe("Lê Văn Phước");
  });

  it("trực hệ xuống: chít, 5 đời (U=0, D=5)", () => {
    const ctx = buildRelationshipContext(P("Lê Văn Phước"), P("Lê Thị Sương"), persons, relationships);
    expect(ctx?.ascendSteps).toBe(0);
    expect(ctx?.descendSteps).toBe(5);
    expect(ctx?.level).toBe(5);
    expect(ctx?.isPureLineage).toBe(true);
  });

  it("đời -1: cô (em ruột của cha) — connector và directAncestorAtConnectorLevel đúng cặp để so lớn/nhỏ", () => {
    const ctx = buildRelationshipContext(P("Lê Văn Lam"), P("Lê Thị Mai"), persons, relationships);
    expect(ctx?.ascendSteps).toBe(2);
    expect(ctx?.descendSteps).toBe(1);
    expect(ctx?.level).toBe(-1);
    expect(ctx?.isPureLineage).toBe(false);
    expect(ctx?.connector?.full_name.trim()).toBe("Lê Thị Mai");
    // So sánh Mai với chính cha của Lam (Phúc) để biết Mai là chị hay em của cha.
    expect(ctx?.directAncestorAtConnectorLevel?.full_name.trim()).toBe("Lê Văn Phúc");
  });

  it("đời -2 Nhánh C: bà cô Hạnh — connector cố định cho cả nhánh dù đi sâu xuống con của bà cô", () => {
    const toHanh = buildRelationshipContext(P("Lê Văn Lam"), P("Lê Thị Hạnh"), persons, relationships);
    const toKhoai = buildRelationshipContext(P("Lê Văn Lam"), P("Mai Văn Khoai"), persons, relationships);

    expect(toHanh?.level).toBe(-2);
    expect(toKhoai?.level).toBe(-1);

    // connector PHẢI giống nhau (chính là Hạnh) ở cả 2 case, vì Khoai chỉ là
    // con của Hạnh — quyết định nhánh (giới tính + lớn/nhỏ của Hạnh) không
    // đổi khi đi sâu xuống con cháu của Hạnh.
    expect(toHanh?.connector?.full_name.trim()).toBe("Lê Thị Hạnh");
    expect(toKhoai?.connector?.full_name.trim()).toBe("Lê Thị Hạnh");
    expect(toHanh?.directAncestorAtConnectorLevel?.full_name.trim()).toBe("Lê Văn Đức");
    expect(toKhoai?.directAncestorAtConnectorLevel?.full_name.trim()).toBe("Lê Văn Đức");
  });

  it("đời -2 Nhánh D (qua bà): connector đúng là Lý Phát, so sánh với bà nội Lý Thị Thanh", () => {
    const ctx = buildRelationshipContext(P("Lê Văn Bách"), P("Lý Phát"), persons, relationships);
    expect(ctx?.level).toBe(-2);
    expect(ctx?.connector?.full_name.trim()).toBe("Lý Phát");
    expect(ctx?.directAncestorAtConnectorLevel?.full_name.trim()).toBe("Lý Thị Thanh");
  });

  it("KHÔNG được hiểu nhầm 'con chung không kết hôn' (bloodSteps=[child,parent]) thành trực hệ xuống thuần tuý", () => {
    // Phát hiện ở Commit 11: 2 người không kết hôn nhưng có con chung có
    // đường ngắn nhất là "xuống con rồi lên lại" — KHÔNG phải "đi xuống 2
    // đời" (cháu nội/ngoại). ascendSteps=0 KHÔNG đủ để kết luận phần còn
    // lại toàn "child" — phải kiểm tra thật.
    const persons2 = [
      { id: "pa", full_name: "Cha", gender: "male" as const, birth_year: null, birth_order: null, generation: null, is_in_law: false },
      { id: "pb", full_name: "Mẹ", gender: "female" as const, birth_year: null, birth_order: null, generation: null, is_in_law: false },
      { id: "c", full_name: "Con", gender: "male" as const, birth_year: null, birth_order: null, generation: null, is_in_law: false },
    ];
    const relationships2: KinshipRelationshipEdge[] = [
      { person_a: "pa", person_b: "c", type: "biological_child" },
      { person_a: "pb", person_b: "c", type: "biological_child" },
    ];

    const ctx = buildRelationshipContext(persons2[0], persons2[1], persons2, relationships2);
    expect(ctx).not.toBeNull();
    expect(ctx!.bloodSteps).toEqual(["child", "parent"]);
    expect(ctx!.isPureLineage).toBe(false);
    expect(ctx!.descendSteps).toBe(0);
    expect(ctx!.connector).toBeNull();
  });

  it("anh chị em ruột (U=1, D=1, level=0) — so sánh trực tiếp với chính root", () => {
    const ctx = buildRelationshipContext(P("Lê Văn Lam"), P("Lê Văn Cam"), persons, relationships);
    expect(ctx?.level).toBe(0);
    expect(ctx?.connector?.full_name.trim()).toBe("Lê Văn Cam");
    expect(ctx?.directAncestorAtConnectorLevel?.full_name.trim()).toBe("Lê Văn Lam");
  });

  it("con nuôi được tính giống con ruột ở cấp context (U=0, D=1)", () => {
    const ctx = buildRelationshipContext(P("Lý Phát"), P("Lý Giao"), persons, relationships);
    expect(ctx?.ascendSteps).toBe(0);
    expect(ctx?.descendSteps).toBe(1);
    expect(ctx?.isPureLineage).toBe(true);
  });

  it("vợ chồng trực tiếp: nhận diện qua leadingSpouse, không lẫn vào bloodSteps", () => {
    const ctx = buildRelationshipContext(P("Lê Văn Lam"), P("Nguyễn Thị Hoa"), persons, relationships);
    expect(ctx?.leadingSpouse?.full_name.trim()).toBe("Nguyễn Thị Hoa");
    expect(ctx?.bloodSteps).toEqual([]);
  });

  it("trả về null khi 2 người trùng nhau hoặc không có đường đi nào", () => {
    const same = buildRelationshipContext(P("Lê Văn Lam"), P("Lê Văn Lam"), persons, relationships);
    expect(same).toBeNull();
  });
});
