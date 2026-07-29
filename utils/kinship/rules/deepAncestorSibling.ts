import type { KinshipPersonNode } from "../kinshipHelpers";
import type { RelationshipContext } from "../relationshipContext";

/**
 * Rule set: BÀNG HỆ TẦNG LIỀN KỀ ĐỜI -3, -4 (mục 3.3, bản v3).
 *
 * Đây là ĐÚNG CÙNG THUẬT TOÁN với renderGreatUncleAuntBranchTerm() (Commit
 * 6) ở D=1, chỉ khác: reference không cố định ở U=3 ("Ông") mà mở rộng ra
 * U=4 ("Ông cố") và U=5 ("Ông sơ") — tức nhân vật cần gọi tên là anh/chị/em
 * ruột của tổ tiên ở đời -3 hoặc -4, cộng thêm hậu tố " đời cố"/" đời sơ".
 *
 * Theo bản v3: "Con cháu của các vị này (D≥2) nằm ngoài phạm vi thực tế cần
 * code chi tiết" — nên rule set này CHỈ xử lý D=1. D≥2 hoặc U≥6 (đời -5 trở
 * đi) trả về null, để rule set fallback chung (mục 5.6, chưa code ở Commit
 * này) xử lý bằng nhãn chung.
 *
 * Thực tế hầu như không xảy ra (cần cụ/sơ có anh chị em ruột được ghi nhận)
 * — không có trong dữ liệu demo thật, nên test dùng fixture giả lập.
 */

function isBornBefore(
  a: { birth_order: number | null; birth_year: number | null },
  b: { birth_order: number | null; birth_year: number | null },
): boolean | null {
  if (a.birth_order != null && b.birth_order != null) return a.birth_order < b.birth_order;
  if (a.birth_year != null && b.birth_year != null) return a.birth_year < b.birth_year;
  return null;
}

const DEPTH_SUFFIX: Record<number, string> = {
  4: " đời cố",
  5: " đời sơ",
};

export function renderDeepAncestorSiblingTerm(
  ctx: RelationshipContext,
  target: KinshipPersonNode,
): string | null {
  if (ctx.ascendSteps !== 4 && ctx.ascendSteps !== 5) return null;
  if (ctx.descendSteps !== 1) return null; // D>=2 ngoài phạm vi (theo bản v3)

  const reference = ctx.directAncestorAtConnectorLevel;
  const connector = ctx.connector;
  if (!reference || !connector) return null;
  // Đảm bảo connector chính là target (D=1 nghĩa là target chính là người
  // rẽ nhánh, không phải con cháu của người đó).
  if (connector.id !== target.id) return null;

  const suffix = DEPTH_SUFFIX[ctx.ascendSteps] ?? "";
  const branchIsElder = isBornBefore(connector, reference);

  if (reference.gender === "male") {
    if (connector.gender === "female") return `bà cô${suffix}`;
    if (connector.gender === "male") {
      if (branchIsElder === true) return `ông bác${suffix}`;
      if (branchIsElder === false) return `ông chú${suffix}`;
      return null;
    }
    return null;
  }

  if (reference.gender === "female") {
    if (connector.gender === "male") return `ông cậu${suffix}`;
    if (connector.gender === "female") return `bà dì${suffix}`;
    return null;
  }

  return null;
}
