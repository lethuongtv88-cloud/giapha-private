import type { RelationshipContext } from "../relationshipContext";

/**
 * Rule set: BÀNG HỆ TẦNG LIỀN KỀ ĐỜI -1 (mục 3.1, bản he-thong-danh-xung-final-v3.md).
 *
 * Anh/chị/em ruột của cha hoặc mẹ (root leo 2 đời lên ông/bà, rồi xuống 1
 * đời tới người đó). Chỉ áp dụng đúng U=2, D=1 — KHÔNG áp dụng cho các case
 * level=-1 khác (ví dụ con của "Bà cô" ở mục 3.2 cũng có level=-1 nhưng
 * U=3,D=2 — thuộc rule set khác, xem collateralBranch.ts ở Commit 6).
 *
 * Quy tắc (khác với mục 3.2's "tầng liền kề" — xem rule 4 trong bản v3):
 *   - Nếu người nối là CHA của root (bloodPeople[1].gender === "male"):
 *       connector nam, sinh TRƯỚC cha  → Bác
 *       connector nam, sinh SAU cha    → Chú
 *       connector nữ (không phân biệt sinh trước/sau) → Cô
 *   - Nếu người nối là MẸ của root (bloodPeople[1].gender === "female"):
 *       connector nam (không phân biệt sinh trước/sau) → Cậu
 *       connector nữ (không phân biệt sinh trước/sau) → Dì
 *
 * (Bảng 3.1 không có cột "nhánh lớn/nhỏ" cho Cô/Cậu/Dì như mục 3.2 có cho
 * Nhánh D/E — chỉ Bác/Chú của bên cha mới so sánh thứ tự sinh.)
 *
 * Chưa render "vợ/chồng của họ" (Bác gái/Thím/Dượng/Mợ) — đó là phần affinal
 * chung cho nhiều tầng, để dành 1 rule set riêng sau.
 */

function isBornBefore(
  a: { birth_order: number | null; birth_year: number | null },
  b: { birth_order: number | null; birth_year: number | null },
): boolean | null {
  if (a.birth_order != null && b.birth_order != null && a.birth_order !== b.birth_order) {
    return a.birth_order < b.birth_order;
  }
  if (a.birth_year != null && b.birth_year != null && a.birth_year !== b.birth_year) {
    return a.birth_year < b.birth_year;
  }
  return null; // Không đủ dữ liệu để so sánh
}

export function renderImmediateParentSiblingTerm(ctx: RelationshipContext): string | null {
  if (ctx.leadingSpouse || ctx.trailingSpouse) return null;
  if (ctx.ascendSteps !== 2 || ctx.descendSteps !== 1) return null;

  const parentOnPath = ctx.directAncestorAtConnectorLevel; // cha hoặc mẹ của root
  const connector = ctx.connector; // anh/chị/em ruột của cha/mẹ đó
  if (!parentOnPath || !connector) return null;

  const throughFather = parentOnPath.gender === "male";
  const throughMother = parentOnPath.gender === "female";
  if (!throughFather && !throughMother) return null;

  if (throughFather) {
    if (connector.gender === "female") return "cô";
    if (connector.gender === "male") {
      const connectorBornBefore = isBornBefore(connector, parentOnPath);
      if (connectorBornBefore === true) return "bác";
      if (connectorBornBefore === false) return "chú";
      return null; // Không đủ dữ liệu (thiếu birth_order và birth_year) để phân biệt bác/chú
    }
    return null;
  }

  // throughMother
  if (connector.gender === "male") return "cậu";
  if (connector.gender === "female") return "dì";
  return null;
}
