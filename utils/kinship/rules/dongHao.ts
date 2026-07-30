import type { KinshipPersonNode } from "../../kinshipHelpers";
import type { RelationshipContext } from "../relationshipContext";

/**
 * Rule set: ĐỒNG HAO (mục 3.4, bản v3) — "cột chèo" (2 người đàn ông cùng
 * làm rể 1 nhà, vợ là chị em ruột) và "bạn dâu" (2 người phụ nữ cùng làm
 * dâu 1 nhà, chồng là anh em ruột).
 *
 * KHÔNG chung huyết thống — root và target chỉ liên hệ qua việc vợ/chồng
 * của họ là anh chị em ruột với nhau. Trên đường đi, điều này thể hiện bằng
 * cả 2 đầu đều có bước "spouse" (root -> vợ/chồng mình -> ... -> vợ/chồng
 * target -> target), với đoạn GIỮA (bloodSteps) là quan hệ anh/chị/em ruột
 * thuần tuý (U=1, D=1, level=0) giữa 2 người vợ (hoặc 2 người chồng).
 *
 * So sánh vai vế (anh/em) dựa theo THỨ TỰ SINH CỦA VỢ/CHỒNG mỗi bên, không
 * so tuổi giữa root và target — khớp đúng dongHaoTerm() trong code cũ.
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

export function renderDongHaoTerm(
  ctx: RelationshipContext,
  root: KinshipPersonNode,
  target: KinshipPersonNode,
): string | null {
  if (!root.gender || root.gender !== target.gender) return null;
  if (!ctx.leadingSpouse || !ctx.trailingSpouse) return null;
  if (ctx.ascendSteps !== 1 || ctx.descendSteps !== 1) return null;

  const rootSpouse = ctx.leadingSpouse;
  // connector = bloodPeople[ascendSteps + 1] = người cuối cùng trong đoạn
  // huyết thống giữa (anh/chị/em ruột của rootSpouse) = chính vợ/chồng của
  // target.
  const targetSpouse = ctx.connector;
  if (!targetSpouse) return null;

  const spouseOlder = isBornBefore(rootSpouse, targetSpouse);

  if (root.gender === "male") {
    if (spouseOlder === true) return "anh cột chèo";
    if (spouseOlder === false) return "em cột chèo";
    return "anh/em cột chèo";
  }

  if (root.gender === "female") {
    if (spouseOlder === true) return "chế bạn dâu";
    if (spouseOlder === false) return "em bạn dâu";
    return "chế/em bạn dâu";
  }

  return null;
}
