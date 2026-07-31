import type { KinshipPersonNode } from "../../kinshipHelpers";
import type { RelationshipContext } from "../relationshipContext";

/**
 * Rule set: BÀNG HỆ TẦNG LIỀN KỀ ĐỜI -3, -4 (mục 3.3, bản v3).
 *
 * ĐÚNG CÙNG THUẬT TOÁN với renderGreatUncleAuntBranchTerm() (Commit 6+13),
 * chỉ khác: reference không cố định ở U=3 ("Ông") mà mở rộng ra U=4 ("Ông
 * cố") và U=5 ("Ông sơ"), cộng thêm hậu tố " đời cố"/" đời sơ" vào MỌI danh
 * xưng (D=1, D=2, D=3 — không chỉ D=1).
 *
 * LƯU Ý QUAN TRỌNG: bản v3 chỉ định nghĩa rõ D=1 ("Ông bác đời cố"...) và
 * nói thẳng "con cháu của các vị này (D≥2) nằm ngoài phạm vi thực tế cần
 * code chi tiết". D=2, D=3 ở đây là SUY LUẬN MỞ RỘNG (áp dụng lại đúng công
 * thức đã xác nhận ở mục 3.2/Commit 13, chỉ thêm hậu tố cho nhất quán) theo
 * yêu cầu người dùng — KHÔNG phải văn bản gốc của bản v3. Nếu cách xưng hô
 * thực tế của gia đình khác, cần điều chỉnh lại rule set này.
 *
 * Thực tế hầu như không xảy ra (cần cụ/sơ có anh chị em ruột VÀ con cháu
 * của họ được ghi nhận) — không có trong dữ liệu thật, test dùng fixture
 * giả lập hoàn toàn.
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

const DEPTH_SUFFIX: Record<number, string> = {
  4: " đời cố",
  5: " đời sơ",
};

export function renderDeepAncestorSiblingTerm(
  ctx: RelationshipContext,
  target: KinshipPersonNode,
): string | null {
  if (ctx.leadingSpouse || ctx.trailingSpouse) return null;
  if (ctx.ascendSteps !== 4 && ctx.ascendSteps !== 5) return null;
  if (ctx.descendSteps !== 1 && ctx.descendSteps !== 2 && ctx.descendSteps !== 3) return null;

  const reference = ctx.directAncestorAtConnectorLevel;
  const connector = ctx.connector;
  const rootOwnParent = ctx.bloodPeople[1] ?? null;
  if (!reference || !connector || !rootOwnParent) return null;

  const suffix = DEPTH_SUFFIX[ctx.ascendSteps] ?? "";
  const branchIsElder = isBornBefore(connector, reference);

  if (ctx.descendSteps === 1) {
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

  if (ctx.descendSteps === 3) {
    if (branchIsElder === true) {
      if (target.gender === "male") return `anh họ${suffix}`;
      if (target.gender === "female") return `chế họ${suffix}`;
      return null;
    }
    if (branchIsElder === false) return `em họ${suffix}`;
    return null;
  }

  // descendSteps === 2
  const rootOwnSideIsNoi = rootOwnParent.gender === "male";
  const rootOwnSideIsNgoai = rootOwnParent.gender === "female";
  if (!rootOwnSideIsNoi && !rootOwnSideIsNgoai) return null;

  if (rootOwnSideIsNgoai) {
    if (target.gender === "male") return `cậu${suffix}`;
    if (target.gender === "female") return `dì${suffix}`;
    return null;
  }

  if (branchIsElder === true) {
    if (target.gender === "male") return `bác${suffix}`;
    if (target.gender === "female") return `cô${suffix}`;
    return null;
  }
  if (branchIsElder === false) {
    if (target.gender === "male") return `chú${suffix}`;
    if (target.gender === "female") return `cô${suffix}`;
    return null;
  }
  return null;
}
