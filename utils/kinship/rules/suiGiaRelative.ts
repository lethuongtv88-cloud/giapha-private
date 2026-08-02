import {
  getRelationshipPath,
  type KinshipPersonNode,
  type KinshipRelationshipEdge,
} from "../../kinshipHelpers";
import { renderKinshipTermV2 } from "../ruleEngine";

/**
 * Rule set: SUI GIA — HỌ HÀNG KHÁC (mục 4, dòng 2-3, bản v3), PHẠM VI THU
 * GỌN theo thoả thuận với người dùng (2026-07-31).
 *
 * Bản v3 gốc yêu cầu so sánh "vai vế" độc lập ở CẢ 2 nhà (cùng vai vế →
 * mục 2-3 + hậu tố "bên sui"; lệch vai vế → ghép 2 nhà làm 1). Người dùng
 * đề xuất cách đặt tên THỰC TẾ đơn giản hơn, áp dụng thống nhất cho MỌI
 * trường hợp (không cần so sánh vai vế 2 bên):
 *
 *   [danh xưng mục 2-3, tính XX (con dâu/rể) làm gốc, target là đối tượng]
 *     + " " + ["vợ" nếu XX nữ, "chồng" nếu XX nam] + " " + [tên riêng của XX]
 *
 * Ví dụ: "chú vợ Dương" = chú của Dương (Dương làm gốc) + Dương là vợ của
 * con trai root. "anh chồng Vũ" = anh của Vũ (Vũ làm gốc) + Vũ là chồng của
 * con gái root.
 *
 * PHẠM VI: chỉ khi XX là vợ/chồng của CON RUỘT TRỰC TIẾP của root (đúng
 * theo "con trai/con gái mình" ở dòng 1 mục 4, không mở rộng ra cháu/cháu
 * họ). Nếu target chính là cha/mẹ ruột của XX, KHÔNG dùng rule set này —
 * giữ nguyên "Ông sui/Bà sui" (renderSuiGiaTerm, Commit 10), được kiểm tra
 * TRƯỚC trong dispatcher (ruleEngine.ts) nên tự động không đụng nhau.
 */

function firstNameOnly(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName.trim();
}

export function renderSuiGiaRelativeTerm(
  root: KinshipPersonNode,
  target: KinshipPersonNode,
  persons: KinshipPersonNode[],
  relationships: KinshipRelationshipEdge[],
): string | null {
  const path = getRelationshipPath(root, target, persons, relationships);
  if (!path) return null;
  if (path.steps.length < 3) return null; // cần ít nhất [child, spouse, +1 bước nữa] — nếu chỉ [child, spouse] thì target chính là XX (con dâu/rể), không phải họ hàng của XX
  if (path.steps[0] !== "child" || path.steps[1] !== "spouse") return null;

  const xx = path.people[2];
  if (!xx) return null;
  if (xx.gender !== "male" && xx.gender !== "female") return null;

  const subTerm = renderKinshipTermV2(xx, target, persons, relationships);
  if (!subTerm) return null;

  const spouseWord = xx.gender === "female" ? "vợ" : "chồng";
  return `${subTerm} ${spouseWord} ${firstNameOnly(xx.full_name)}`;
}
