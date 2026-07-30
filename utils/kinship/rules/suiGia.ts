import {
  getRelationshipPath,
  type KinshipPersonNode,
  type KinshipRelationshipEdge,
} from "../../kinshipHelpers";

/**
 * Rule set: SUI GIA (mục 4, dòng 1 — "Ông sui / Bà sui"), bản v3.
 *
 * "Cha của con dâu/con rể ↔ cha của con trai/con gái mình" — chỉ đúng
 * trường hợp CON RUỘT của root đã kết hôn (D=1 thuần), và target là CHA/MẸ
 * RUỘT của người dâu/rể đó.
 *
 * Cấu trúc đường đi: bước vợ/chồng nằm Ở GIỮA (con -> dâu/rể -> cha/mẹ của
 * dâu/rể), KHÔNG phải ở 2 đầu như dongHao.ts hay siblingAndChildInLaw.ts —
 * nên RelationshipContext hiện tại (chỉ tách vợ/chồng ở biên) không áp
 * dụng trực tiếp được. Rule set này đọc thẳng từ getRelationshipPath().
 *
 * PHẠM VI: chỉ dòng 1 của mục 4 (Ông sui/Bà sui). Dòng 2-3 (họ hàng khác
 * của 2 bên sui gia, so vai vế lệch nhau) phức tạp hơn nhiều (cần tính vai
 * vế độc lập ở cả 2 nhà), để dành 1 commit riêng sau nếu cần.
 */
export function renderSuiGiaTerm(
  root: KinshipPersonNode,
  target: KinshipPersonNode,
  persons: KinshipPersonNode[],
  relationships: KinshipRelationshipEdge[],
): string | null {
  const path = getRelationshipPath(root, target, persons, relationships);
  if (!path) return null;
  if (path.steps.length !== 3) return null;

  const [step1, step2, step3] = path.steps;
  if (step1 !== "child" || step2 !== "spouse" || step3 !== "parent") return null;

  if (target.gender === "male") return "ông sui";
  if (target.gender === "female") return "bà sui";
  return "ông/bà sui";
}
