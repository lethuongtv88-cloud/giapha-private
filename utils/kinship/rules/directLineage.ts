import type { KinshipPersonNode } from "../../kinshipHelpers";
import type { RelationshipContext } from "../relationshipContext";

/**
 * Rule set: TRỰC HỆ (mục 2, bản he-thong-danh-xung-final-v3.md).
 *
 * Áp dụng khi ctx.isPureLineage === true (toàn bộ đường đi chỉ toàn "parent"
 * hoặc toàn "child", không rẽ nhánh) và phạm vi ±5 đời (mục 1.9).
 *
 * KHÔNG có nhánh lớn/nhỏ hay quy tắc "tầng liền kề" ở đây — mục 2 là phần
 * đơn giản nhất trong bản v3, và theo test Commit 1 (27 case dữ liệu thật),
 * hành vi hiện tại của code cũ đã ĐÚNG với mục 2 — module này chỉ viết lại
 * bằng kiến trúc RelationshipContext, không đổi kết quả.
 */

function appendSide(term: string, side: "nội" | "ngoại" | null): string {
  return side ? `${term} bên ${side}` : term;
}

function genderParentWord(person: KinshipPersonNode | null): string {
  if (person?.gender === "female") return "mẹ";
  if (person?.gender === "male") return "cha";
  return "cha/mẹ";
}

function genderChildWord(person: KinshipPersonNode | null): string {
  if (person?.gender === "female") return "con gái";
  if (person?.gender === "male") return "con trai";
  return "con";
}

/** Trực hệ LÊN (root leo lên tổ tiên): nội/ngoại xác định bởi giới tính của
 * cha/mẹ root trên đường đi (mục 1.3: "qua cha → nội, qua mẹ → ngoại"),
 * cố định cho cả đường lên dù đi bao xa. */
function ascendSide(ctx: RelationshipContext): "nội" | "ngoại" | null {
  const firstStepUp = ctx.bloodPeople[1] ?? null;
  if (!firstStepUp) return null;
  if (firstStepUp.gender === "male") return "nội";
  if (firstStepUp.gender === "female") return "ngoại";
  return null;
}

/** Trực hệ XUỐNG (root đi xuống hậu duệ): "cháu nội/ngoại" xác định bởi
 * giới tính CON của root trên đường đi (không phải giới tính cháu). */
function descendSide(ctx: RelationshipContext): "nội" | "ngoại" | null {
  const firstStepDown = ctx.bloodPeople[1] ?? null;
  if (!firstStepDown) return null;
  if (firstStepDown.gender === "male") return "nội";
  if (firstStepDown.gender === "female") return "ngoại";
  return null;
}

function renderAscend(ctx: RelationshipContext, target: KinshipPersonNode): string | null {
  const depth = ctx.ascendSteps;
  const side = ascendSide(ctx);

  if (depth === 1) return genderParentWord(target);

  if (depth === 2) {
    const base = target.gender === "female" ? "bà" : "ông";
    return side ? `${base} ${side}` : base;
  }

  if (depth === 3) {
    const base = target.gender === "female" ? "bà cố" : "ông cố";
    return appendSide(base, side);
  }

  if (depth === 4) {
    const base = target.gender === "female" ? "bà sơ" : "ông sơ";
    return appendSide(base, side);
  }

  if (depth === 5) {
    // Đời -5: "Ông sơ"/"Bà sơ" là vợ chồng ở đời -4, nên đời -5 = cha/mẹ
    // ruột của người đời -4 tương ứng trên cùng đường đi — ghép "Cha/Mẹ" +
    // tên đời -4 (mục 2, dòng ±5).
    const depth4Ancestor = ctx.bloodPeople[4] ?? null;
    const depth4Term = depth4Ancestor?.gender === "female" ? "Bà sơ" : "Ông sơ";
    const parentWord = genderParentWord(target);
    const capitalized = parentWord.charAt(0).toLocaleUpperCase("vi") + parentWord.slice(1);
    return appendSide(`${capitalized} ${depth4Term}`, side);
  }

  return null; // Ngoài phạm vi ±5 đời (mục 1.9) — không thuộc rule set này.
}

function renderDescend(ctx: RelationshipContext, target: KinshipPersonNode): string | null {
  const depth = ctx.descendSteps;

  if (depth === 1) return genderChildWord(target);

  if (depth === 2) {
    const side = descendSide(ctx);
    if (side === "nội") return "cháu nội";
    if (side === "ngoại") return "cháu ngoại";
    return "cháu";
  }

  if (depth === 3) return "chắt";
  if (depth === 4) return "chút";
  if (depth === 5) return "chít";

  return null; // Ngoài phạm vi ±5 đời.
}

/**
 * Render danh xưng trực hệ theo mục 2. Trả về null nếu:
 *   - ctx không phải trực hệ thuần (ctx.isPureLineage === false), hoặc
 *   - cùng vai vế thuần tuý (level === 0, tức root === target — không xảy
 *     ra vì buildRelationshipContext() đã trả null khi 2 người trùng nhau),
 *     hoặc trường hợp vợ/chồng thuần (bloodSteps rỗng, level === 0 nhưng
 *     không có ascend/descend nào) — không thuộc mục 2, để rule set khác xử lý.
 *   - vượt phạm vi ±5 đời.
 *
 * `target` = người được gọi tên (ứng với chiều đang xét: nếu root leo lên,
 * target là tổ tiên; nếu root đi xuống, target là hậu duệ).
 */
export function renderDirectLineageTerm(ctx: RelationshipContext, target: KinshipPersonNode): string | null {
  if (ctx.leadingSpouse || ctx.trailingSpouse) return null; // Còn vợ/chồng dư, không phải trực hệ thuần
  if (!ctx.isPureLineage) return null;
  if (ctx.ascendSteps === 0 && ctx.descendSteps === 0) return null; // vợ/chồng thuần, không phải mục 2

  if (ctx.descendSteps === 0) return renderAscend(ctx, target);
  if (ctx.ascendSteps === 0) return renderDescend(ctx, target);

  return null;
}
