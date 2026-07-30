import { describe, expect, it } from "vitest";
import { buildRelationshipContext } from "../../utils/kinship/relationshipContext";
import { renderDirectLineageTerm } from "../../utils/kinship/rules/directLineage";
import { renderSiblingTerm } from "../../utils/kinship/rules/siblingAndChildInLaw";
import { renderGreatUncleAuntBranchTerm } from "../../utils/kinship/rules/greatUncleAuntBranch";
import type { KinshipPersonNode, KinshipRelationshipEdge } from "../../utils/kinshipHelpers";

/**
 * Commit 10b — 2 lỗi phát hiện khi chạy thử toàn bộ N×N (10.894 cặp) trên
 * dữ liệu thật 137 người, chuẩn bị cho Commit 11 (cắt sang dùng thật):
 *
 * 1. Guard vợ/chồng dư: các rule set chỉ xử lý huyết thống (Commit 4-7, và
 *    2 hàm đầu của Commit 8) không kiểm tra ctx.leadingSpouse/trailingSpouse
 *    trước khi render, khiến chúng "quên" mất còn 1 bước vợ/chồng chưa xử
 *    lý và render sai (dùng nhầm giới tính của người sai).
 *
 * 2. isBornBefore(): khi birth_order TRÙNG nhau giữa 2 người (lỗi nhập liệu
 *    hoặc sinh đôi), hàm dừng lại luôn thay vì rơi về birth_year để phân
 *    định — khiến so sánh lớn/nhỏ sai trong nhiều rule set.
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

const marriage = (a: string, b: string): KinshipRelationshipEdge => ({
  person_a: a,
  person_b: b,
  type: "marriage",
});

describe("Commit 10b — guard vợ/chồng dư chưa xử lý", () => {
  it("renderDirectLineageTerm: không được coi 'vợ của cha' là 'mẹ'", () => {
    // Con chỉ được ghi nhận CÓ CHA, không có mẹ ruột — mẹ kế/vợ của cha
    // phải được nhận diện là còn dư 1 bước vợ/chồng, KHÔNG được lấy giới
    // tính của bà ấy để trả lời "mẹ".
    const persons = [
      person("root", "Con", { gender: "male" }),
      person("father", "Cha", { gender: "male" }),
      person("fatherWife", "Vợ của cha (không phải mẹ ruột)", { gender: "female" }),
    ];
    const relationships: KinshipRelationshipEdge[] = [
      child("father", "root"),
      marriage("father", "fatherWife"),
    ];

    const ctx = buildRelationshipContext(persons[0], persons[2], persons, relationships);
    expect(ctx).not.toBeNull();
    expect(ctx!.trailingSpouse?.id).toBe("fatherWife");
    // Rule set trực hệ PHẢI từ chối (null), không được trả "mẹ".
    expect(renderDirectLineageTerm(ctx!, persons[2])).toBeNull();
  });

  it("renderSiblingTerm: không được nhầm vợ của anh/em ruột thành chính anh/em ruột", () => {
    const persons = [
      person("root", "Root", { gender: "male" }),
      person("brother", "Anh trai", { gender: "male", birth_order: 1 }),
      person("brotherWife", "Vợ của anh trai", { gender: "female" }),
      person("father", "Cha", { gender: "male" }),
    ];
    const relationships: KinshipRelationshipEdge[] = [
      child("father", "root"),
      child("father", "brother"),
      marriage("brother", "brotherWife"),
    ];
    const ctx = buildRelationshipContext(persons[0], persons[2], persons, relationships);
    expect(ctx).not.toBeNull();
    expect(renderSiblingTerm(ctx!, persons[2])).toBeNull();
  });
});

describe("Commit 10b — isBornBefore rơi về birth_year khi birth_order trùng", () => {
  it("2 anh em ruột cùng birth_order nhưng khác birth_year -> vẫn so sánh đúng theo năm sinh", () => {
    const persons = [
      person("root", "Root", { gender: "male", birth_order: 3, birth_year: 1935 }),
      person("sibling", "Anh/chị (birth_order trùng, sinh năm sớm hơn)", {
        gender: "male",
        birth_order: 3,
        birth_year: 1934,
      }),
      person("father", "Cha", { gender: "male" }),
    ];
    const relationships: KinshipRelationshipEdge[] = [
      child("father", "root"),
      child("father", "sibling"),
    ];

    const ctx = buildRelationshipContext(persons[0], persons[1], persons, relationships);
    expect(ctx).not.toBeNull();
    // sibling sinh năm 1934, root sinh năm 1935 -> sibling LỚN HƠN dù
    // birth_order ghi trùng nhau -> root phải gọi sibling là "anh"
    expect(renderSiblingTerm(ctx!, persons[1])).toBe("anh");
  });

  it("lan toả đúng xuống rule set đời -2 (con của người có birth_order trùng)", () => {
    // Mô phỏng lại đúng case thật: Khang & Đức cùng birth_order nhưng khác
    // birth_year -> ảnh hưởng tới con của Khang khi gọi Đức là bác/chú.
    // Cấu trúc đúng mục 3.2 (U=3): root -> cha -> "Đức" (ông của root) ->
    // "ông cố" (tổ tiên chung) -> "Khang" (em/anh của Đức, D=1 từ ông cố).
    const persons = [
      person("root", "Con của Khang", { gender: "male" }),
      person("cha", "Cha (con của Khang)", { gender: "male" }),
      person("duc", "Đức (ông của root, birth_order trùng Khang)", {
        gender: "male",
        birth_order: 3,
        birth_year: 1934,
      }),
      person("ongCo", "Ông cố (cha chung của Khang và Đức)", { gender: "male" }),
      person("khang", "Khang (anh/em của Đức, birth_order trùng)", {
        gender: "male",
        birth_order: 3,
        birth_year: 1935,
      }),
    ];
    const relationships: KinshipRelationshipEdge[] = [
      child("cha", "root"),
      child("duc", "cha"),
      child("ongCo", "duc"),
      child("ongCo", "khang"),
    ];

    const ctx = buildRelationshipContext(persons[0], persons[4], persons, relationships);
    expect(ctx).not.toBeNull();
    // Đức sinh 1934 (trước Khang 1935) -> Đức là ANH của Khang, tức Khang
    // là EM -> root gọi Khang (D=1, chính connector) là "ông chú".
    expect(renderGreatUncleAuntBranchTerm(ctx!, persons[4])).toBe("ông chú");
  });
});
