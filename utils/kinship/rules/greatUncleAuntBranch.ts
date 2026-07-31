import type { KinshipPersonNode } from "../../kinshipHelpers";
import type { RelationshipContext } from "../relationshipContext";

/**
 * Rule set: BÀNG HỆ ĐỜI -2, 5 NHÁNH A-E (mục 3.2, bản he-thong-danh-xung-final-v3.md).
 *
 * Chỉ áp dụng đúng U=3 (root leo 3 đời lên tổ tiên chung — tức "Cố" — rồi
 * xuống 1, 2, hoặc 3 đời). D=1 (tầng liền kề, chính "Ông bác/Ông chú/Bà
 * cô/Ông cậu/Bà dì"), D=2 (con của họ), D=3 ("Cháu đời 0" — anh/chế/em họ,
 * cùng vai vế với root).
 *
 * QUY TẮC (đã xác nhận qua dữ liệu thật + trao đổi trực tiếp với người dùng,
 * không suy ra thuần tuý từ cách diễn đạt bảng — bảng viết mục C không có
 * cột lớn/nhỏ nhưng thực tế CÓ, xem ghi chú bên dưới):
 *
 *   - reference = ctx.directAncestorAtConnectorLevel ("ông" hoặc "bà" — tổ
 *     tiên trực hệ của root mà connector là anh/chị/em ruột).
 *   - connector = ctx.connector (chính "Ông bác/Ông chú/Bà cô/Ông cậu/Bà dì").
 *   - branchIsElder = connector sinh TRƯỚC reference (dùng birth_order, dự
 *     phòng birth_year) — áp dụng cho MỌI connector bất kể giới tính (kể cả
 *     Nhánh C/"Bà cô": bà cô sinh trước ông → xử lý như nhánh lớn, sinh sau
 *     → như nhánh nhỏ — người dùng xác nhận trực tiếp, dù bảng viết mục C
 *     giống hệt mục B không phân biệt).
 *   - rootOwnSide = giới tính CHA/MẸ RUỘT của chính root trên đường đi này
 *     (ctx.bloodPeople[1]) — nam → nội, nữ → ngoại. Quyết định hệ vocab
 *     (Bác/Chú/Cô hay Cậu/Dì) cho D=2, KHÔNG dùng cho D=3 (xem bên dưới).
 *
 *   D=1 (tầng liền kề): hệ chọn theo reference.gender.
 *     reference nam ("ông"):
 *       connector nam, branchIsElder → "ông bác"
 *       connector nam, !branchIsElder → "ông chú"
 *       connector nữ → "bà cô"
 *     reference nữ ("bà"):
 *       connector nam → "ông cậu"
 *       connector nữ → "bà dì"
 *
 *   D=2 (con của connector): hệ chọn theo rootOwnSide.
 *     rootOwnSide nội:
 *       branchIsElder: target nam → "bác", target nữ → "cô"
 *       !branchIsElder: target nam → "chú", target nữ → "cô"
 *     rootOwnSide ngoại (không phân biệt lớn/nhỏ ở tầng này):
 *       target nam → "cậu", target nữ → "dì"
 *
 *   D=3 (Cháu đời 0 — cùng vai vế root): CHỈ phụ thuộc branchIsElder, KHÔNG
 *   còn phân biệt nội/ngoại nữa (bảng liệt kê "Anh/Chế họ" / "Em họ" giống
 *   nhau ở mọi nhánh nội/ngoại, xem mục 4 quy tắc "cả nhánh dùng chung 1
 *   cách xưng hô"):
 *     branchIsElder: target nam → "anh họ", target nữ → "chế họ"
 *     !branchIsElder: "em họ" (không phân biệt giới tính target)
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
  return null;
}

export function renderGreatUncleAuntBranchTerm(
  ctx: RelationshipContext,
  target: KinshipPersonNode,
): string | null {
  if (ctx.leadingSpouse || ctx.trailingSpouse) return null;
  if (ctx.ascendSteps !== 3) return null;
  if (ctx.descendSteps !== 1 && ctx.descendSteps !== 2 && ctx.descendSteps !== 3) return null;

  const reference = ctx.directAncestorAtConnectorLevel;
  const connector = ctx.connector;
  const rootOwnParent = ctx.bloodPeople[1] ?? null;
  if (!reference || !connector || !rootOwnParent) return null;

  const branchIsElder = isBornBefore(connector, reference);

  if (ctx.descendSteps === 1) {
    if (reference.gender === "male") {
      if (connector.gender === "female") return "bà cô";
      if (connector.gender === "male") {
        if (branchIsElder === true) return "ông bác";
        if (branchIsElder === false) return "ông chú";
        return null; // Thiếu dữ liệu birth_order/birth_year để phân biệt
      }
      return null;
    }
    if (reference.gender === "female") {
      if (connector.gender === "male") return "ông cậu";
      if (connector.gender === "female") return "bà dì";
      return null;
    }
    return null;
  }

  if (ctx.descendSteps === 3) {
    if (branchIsElder === true) {
      if (target.gender === "male") return "anh họ";
      if (target.gender === "female") return "chế họ";
      return null;
    }
    if (branchIsElder === false) return "em họ";
    return null; // Thiếu dữ liệu để phân biệt nhánh lớn/nhỏ
  }

  // descendSteps === 2
  const rootOwnSideIsNoi = rootOwnParent.gender === "male";
  const rootOwnSideIsNgoai = rootOwnParent.gender === "female";
  if (!rootOwnSideIsNoi && !rootOwnSideIsNgoai) return null;

  if (rootOwnSideIsNgoai) {
    if (target.gender === "male") return "cậu";
    if (target.gender === "female") return "dì";
    return null;
  }

  // rootOwnSideIsNoi
  if (branchIsElder === true) {
    if (target.gender === "male") return "bác";
    if (target.gender === "female") return "cô";
    return null;
  }
  if (branchIsElder === false) {
    if (target.gender === "male") return "chú";
    if (target.gender === "female") return "cô";
    return null;
  }
  return null; // Thiếu dữ liệu để phân biệt bác/chú
}
