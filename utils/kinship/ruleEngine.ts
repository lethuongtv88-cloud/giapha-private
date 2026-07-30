import type { KinshipPersonNode, KinshipRelationshipEdge } from "../kinshipHelpers";
import { buildRelationshipContext } from "./relationshipContext";
import { renderDirectLineageTerm } from "./rules/directLineage";
import { renderImmediateParentSiblingTerm } from "./rules/immediateParentSibling";
import { renderGreatUncleAuntBranchTerm } from "./rules/greatUncleAuntBranch";
import { renderDeepAncestorSiblingTerm } from "./rules/deepAncestorSibling";
import {
  renderChildOrGrandchildInLawTerm,
  renderNiblingTerm,
  renderSiblingTerm,
} from "./rules/siblingAndChildInLaw";
import { renderDongHaoTerm } from "./rules/dongHao";
import { renderSuiGiaTerm } from "./rules/suiGia";

/**
 * Dispatcher tổng hợp Rule Engine V2 (Giai đoạn 2, Commit 3-10).
 *
 * Thử LẦN LƯỢT từng rule set theo đúng thứ tự mục trong bản v3 (2 -> 3.1 ->
 * 3.2 -> 3.3 -> 3.5/3.6 -> 3.4 -> 4). Trả về chuỗi đầu tiên khớp, hoặc
 * `null` nếu KHÔNG rule set nào xử lý được — lúc đó bên gọi (computeKinship
 * trong kinshipHelpers.ts) sẽ tự rơi về logic cũ (termFromPath), đảm bảo
 * không bao giờ mất câu trả lời so với trước khi có rule engine mới.
 *
 * Đo trên dữ liệu thật (137 người, 10.894 cặp có đáp án cụ thể ở code cũ):
 *   - Khớp chính xác với code cũ: ~27%
 *   - Rơi về code cũ an toàn (rule engine mới trả null): ~73%
 *   - Lệch đã biết, không phải lỗi (thiếu hậu tố "bên chồng/vợ"): ~0,1%
 *
 * CHƯA PHỦ (sẽ rơi về code cũ, không phải lỗi — để dành commit sau nếu cần):
 *   - Mục 3.2 D=3 trở lên ("anh/chị/em họ" cùng vai vế qua nhánh xa)
 *   - Mục 3.3 D>=2 (con cháu của anh em ruột cụ/sơ)
 *   - Mục 4 dòng 2-3 (họ hàng khác của 2 bên sui gia)
 *   - Vợ/chồng của người bàng hệ (vd "thím", "dượng") — spouseOfKinshipTerm cũ
 *   - Hậu tố "bên chồng/bên vợ" khi root là người dâu/rể trong nhà
 */
export function renderKinshipTermV2(
  root: KinshipPersonNode,
  target: KinshipPersonNode,
  persons: KinshipPersonNode[],
  relationships: KinshipRelationshipEdge[],
): string | null {
  const suiGia = renderSuiGiaTerm(root, target, persons, relationships);
  if (suiGia) return suiGia;

  const ctx = buildRelationshipContext(root, target, persons, relationships);
  if (!ctx) return null;

  return (
    renderDirectLineageTerm(ctx, target) ??
    renderImmediateParentSiblingTerm(ctx) ??
    renderGreatUncleAuntBranchTerm(ctx, target) ??
    renderDeepAncestorSiblingTerm(ctx, target) ??
    renderSiblingTerm(ctx, target) ??
    renderNiblingTerm(ctx) ??
    renderChildOrGrandchildInLawTerm(ctx) ??
    renderDongHaoTerm(ctx, root, target) ??
    null
  );
}
