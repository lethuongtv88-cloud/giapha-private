import type { KinshipPersonNode } from "../kinshipHelpers";
import type { RelationshipContext } from "../relationshipContext";

/**
 * Rule set: ĐỜI 0 (mục 3.5) + ĐỜI +1, +2 — CHÁU, DÂU, RỂ (mục 3.6),
 * bản he-thong-danh-xung-final-v3.md.
 *
 * Mục 3.5 (anh chị em ruột, U=1 D=1 level=0): so thứ tự sinh (birth_order,
 * dự phòng birth_year) giữa target và root — sinh trước root → Anh/Chế,
 * sinh sau → Em (quy tắc "Chế" thay "Chị" theo mục 1.5, khớp code cũ).
 *
 * Mục 3.6:
 *   - Con của anh/chị/em ruột (U=1, D=2, level=1) → "cháu" (không phân biệt
 *     giới tính, khớp hành vi cũ).
 *   - Vợ/chồng của con hoặc cháu ruột (U=0, trailingSpouse có giá trị,
 *     D=1 hoặc D=2 thuần túy toàn "child"):
 *       D=1, con là con trai → "con dâu" (gọi trailingSpouse)
 *       D=1, con là con gái → "con rể"
 *       D=2, cháu là cháu trai → "cháu dâu"
 *       D=2, cháu là cháu gái → "cháu rể"
 *
 * Đây là rule set ĐẦU TIÊN xử lý quan hệ qua hôn nhân (affinal) — dùng
 * ctx.trailingSpouse thay vì cần gọi getInLawAddressDetail() (hàm cũ đòi
 * hỏi dựng thêm ngữ cảnh side/branch/generation phức tạp, đã quyết định để
 * dành riêng — xem ghi chú Commit 1). Phạm vi ở đây chỉ đúng những gì mục
 * 3.6 liệt kê (con/cháu dâu rể trực tiếp), CHƯA xử lý dâu/rể của các nhánh
 * bàng hệ xa hơn hay sui gia (mục 4, để dành Commit 10).
 */

function isBornBefore(
  a: { birth_order: number | null; birth_year: number | null },
  b: { birth_order: number | null; birth_year: number | null },
): boolean | null {
  if (a.birth_order != null && b.birth_order != null) return a.birth_order < b.birth_order;
  if (a.birth_year != null && b.birth_year != null) return a.birth_year < b.birth_year;
  return null;
}

/** Mục 3.5: anh/chị/em ruột. */
export function renderSiblingTerm(ctx: RelationshipContext, target: KinshipPersonNode): string | null {
  if (ctx.ascendSteps !== 1 || ctx.descendSteps !== 1) return null;

  const root = ctx.directAncestorAtConnectorLevel; // bloodPeople[0], chính root
  if (!root) return null;

  const targetBornBefore = isBornBefore(target, root);
  if (targetBornBefore === null) return null;

  if (targetBornBefore) {
    return target.gender === "female" ? "chế" : "anh";
  }
  return target.gender === "female" ? "em gái" : "em trai";
}

/** Mục 3.6, dòng 1: con của anh/chị/em ruột. */
export function renderNiblingTerm(ctx: RelationshipContext): string | null {
  if (ctx.ascendSteps !== 1 || ctx.descendSteps !== 2) return null;
  return "cháu";
}

/** Mục 3.6, các dòng còn lại: dâu/rể của con hoặc cháu ruột. */
export function renderChildOrGrandchildInLawTerm(ctx: RelationshipContext): string | null {
  if (ctx.ascendSteps !== 0) return null;
  if (!ctx.trailingSpouse) return null;
  if (ctx.descendSteps !== 1 && ctx.descendSteps !== 2) return null;
  if (!ctx.bloodSteps.every((step) => step === "child")) return null;

  const connectingChild = ctx.bloodPeople[ctx.bloodPeople.length - 1] ?? null;
  if (!connectingChild) return null;

  const isSon = connectingChild.gender === "male";
  const isDaughter = connectingChild.gender === "female";
  if (!isSon && !isDaughter) return null;

  if (ctx.descendSteps === 1) {
    return isSon ? "con dâu" : "con rể";
  }

  return isSon ? "cháu dâu" : "cháu rể";
}
