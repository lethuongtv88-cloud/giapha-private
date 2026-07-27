import type { Person, Relationship } from "@/types";
import type {
  FamilyChildRow,
  FamilyParentRow,
  FamilyRow,
} from "@/services/statistics/globalStats.service";
import {
  buildParentChildEdges,
  buildSpouseEdges,
  buildKinshipRelationshipEdges,
  getDirectParents,
  type ParentChildEdge,
  type SpouseEdge,
} from "@/utils/tree/lineageComparison";
import { sortVietnamesePeople, VIET_NODE_WIDTH, VIET_NODE_HEIGHT, VIET_SPOUSE_GAP, VIET_SIBLING_GAP, VIET_GENERATION_GAP, VIET_CHILD_BAR_OFFSET, VIET_MARRIAGE_GROUP_GAP } from "@/utils/tree/vietnameseTreeLayout";
import { computeKinship, type KinshipPersonNode } from "@/utils/kinshipHelpers";

/**
 * Layout dùng chung cho 2 sơ đồ:
 *
 * - "Nội Ngoại": personA = cha người gốc, personB = mẹ người gốc. personA toả tổ
 *   tiên bên trái (họ nội), personB toả tổ tiên bên phải (họ ngoại). Con cháu
 *   toả xuống dưới = con chung của personA/personB (tức người gốc + anh chị em),
 *   rồi tiếp tục xuống các đời sau như bình thường.
 *
 * - "Sui gia": personA = người gốc, personB = vợ/chồng được chọn. personA toả
 *   tổ tiên bên trái (bên nhà mình), personB toả tổ tiên bên phải (bên sui
 *   gia). Con cháu toả xuống dưới = con chung của personA/personB, rồi tiếp
 *   tục xuống các đời sau.
 *
 * Cả 2 trường hợp đều là 1 thuật toán: "quạt phả hệ" (pedigree fan, nhân đôi
 * mỗi đời vì mỗi người có 2 cha mẹ) cho phần tổ tiên, và thuật toán 2-pass
 * (tính bề rộng subtree trước rồi mới đặt toạ độ) cho phần con cháu.
 */

export type CoupleTreeSide = "personA" | "personB" | "descendant";
export type CoupleTreeRole = "blood" | "spouse" | "sibling";

/** 1 đơn vị hôn nhân của 1 người: vợ/chồng (có thể null nếu chưa rõ) + con chung + tình trạng hôn nhân. */
export interface MarriageUnit {
  key: string;
  spouseId: string | null;
  childIds: string[];
  isEnded: boolean;
}

export interface CoupleTreeNode {
  id: string;
  person: Person;
  x: number;
  y: number;
  width: number;
  height: number;
  side: CoupleTreeSide;
  role: CoupleTreeRole;
  /** âm = đời trước (tổ tiên), 0 = đời cặp trung tâm, dương = đời sau (con cháu) */
  generation: number;
  /** thứ tự sinh trong gia đình (nếu có) */
  birthOrder: number | null;
  /** người gốc gọi người này là gì (chỉ có khi bật tuỳ chọn Danh xưng) */
  addressHint?: string | null;
  /** true nếu đây chính là người gốc đang chọn (để làm nổi bật trên sơ đồ) */
  isHighlighted?: boolean;
}

export interface CoupleTreeConnector {
  id: string;
  kind: "spouse" | "descent";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** true nếu đây là đường nối tới 1 người con nuôi (relationship_type = adopted_child) */
  dashed?: boolean;
  /** true nếu đây là đường vợ chồng đã ly hôn/ly thân */
  isEnded?: boolean;
}

export interface CoupleTreeDiagramLayout {
  nodes: CoupleTreeNode[];
  connectors: CoupleTreeConnector[];
  width: number;
  height: number;
  rootCenter: { x: number; y: number };
  personA: Person | null;
  personB: Person | null;
  warnings: string[];
}

export interface BuildCoupleTreeInput {
  /** người bên trái của cặp trung tâm (cha, hoặc chính người gốc trong sơ đồ Sui gia) — có thể bỏ trống nếu chưa rõ */
  personAId?: string | null;
  /** người bên phải của cặp trung tâm (mẹ, hoặc vợ/chồng được chọn trong sơ đồ Sui gia) — có thể bỏ trống */
  personBId?: string | null;
  persons: Person[];
  relationships?: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
  generationsUp?: number;
  generationsDown?: number;
  hideDaughtersInLaw?: boolean;
  hideSonsInLaw?: boolean;
  /** id người mà tất cả nhãn "danh xưng" sẽ được tính theo góc nhìn của người này */
  addressingRootId?: string | null;
  /** hiện chữ danh xưng trên thẻ (mặc định false, tính toán vẫn luôn diễn ra để toggle không cần build lại) */
  showAddressHint?: boolean;
  /** id cần đánh dấu nổi bật (thường là người gốc đang chọn ở trang) */
  highlightPersonId?: string | null;
  /** hiện thêm anh chị em ruột của cặp ở giữa (personA/personB), giống tuỳ chọn "Dòng họ" ở bảng so sánh */
  includeClan?: boolean;
  /** chỉ áp dụng cho personB (vợ/chồng) ở sơ đồ Sui gia: chỉ toả 1 trong 2 nhánh nội/ngoại của họ để bớt rộng */
  branchFilter?: "both" | "paternal" | "maternal";
}

const NODE_WIDTH = VIET_NODE_WIDTH;
const NODE_HEIGHT = VIET_NODE_HEIGHT;
const SPOUSE_GAP = VIET_SPOUSE_GAP;
const SIBLING_GAP = VIET_SIBLING_GAP;
const GENERATION_GAP = VIET_GENERATION_GAP;
const CHILD_BAR_OFFSET = VIET_CHILD_BAR_OFFSET;
const ROW_PITCH = NODE_HEIGHT + GENERATION_GAP;
const CANVAS_PADDING = 90;

const ANCESTOR_SLOT_MARGIN = 46;
const ANCESTOR_SLOT_UNIT = (NODE_WIDTH + ANCESTOR_SLOT_MARGIN) / 2;

interface BuildContext {
  personsMap: Map<string, Person>;
  parentChildEdges: ParentChildEdge[];
  spouseEdges: SpouseEdge[];
  generationsUp: number;
  generationsDown: number;
  hideDaughtersInLaw: boolean;
  hideSonsInLaw: boolean;
  addressingRoot: Person | null;
  allPersons: Person[];
  relationships: Relationship[];
  highlightPersonId: string | null;
  includeClan: boolean;
  branchFilter: "both" | "paternal" | "maternal";
  /** id những người là con nuôi (relationship_type = adopted_child), để vẽ nét đứt trên đường nối xuống họ */
  adoptedChildIds: Set<string>;
  /** mỗi người -> danh sách đơn vị hôn nhân (vợ/chồng + con chung + tình trạng), gộp từ family tables + fallback relationships cũ */
  marriageUnitsByPerson: Map<string, MarriageUnit[]>;
  /** cạnh quan hệ dùng cho computeKinship, gộp từ family tables + relationships cũ (không chỉ đọc mỗi bảng relationships) */
  kinshipEdges: { type: string; person_a: string; person_b: string }[];
}

interface MutableOutput {
  nodes: CoupleTreeNode[];
  connectors: CoupleTreeConnector[];
  seenAncestorKeys: Set<string>;
  warnings: string[];
}

export function buildCoupleTreeDiagram(input: BuildCoupleTreeInput): CoupleTreeDiagramLayout {
  const generationsUp = clamp(input.generationsUp ?? 4, 1, 6);
  const generationsDown = clamp(input.generationsDown ?? 4, 1, 6);
  const hideDaughtersInLaw = input.hideDaughtersInLaw ?? false;
  const hideSonsInLaw = input.hideSonsInLaw ?? false;

  const personsMap = new Map(input.persons.map((person) => [person.id, person]));
  const personA = input.personAId ? (personsMap.get(input.personAId) ?? null) : null;
  const personB = input.personBId ? (personsMap.get(input.personBId) ?? null) : null;

  if (!personA && !personB) {
    return emptyLayout(["Không tìm thấy người ở giữa sơ đồ."]);
  }

  const ctx: BuildContext = {
    personsMap,
    parentChildEdges: buildParentChildEdges(input),
    spouseEdges: buildSpouseEdges(input),
    generationsUp,
    generationsDown,
    hideDaughtersInLaw,
    hideSonsInLaw,
    addressingRoot: input.addressingRootId ? (personsMap.get(input.addressingRootId) ?? null) : null,
    allPersons: input.persons,
    relationships: input.relationships ?? [],
    highlightPersonId: input.highlightPersonId ?? null,
    includeClan: input.includeClan ?? false,
    branchFilter: input.branchFilter ?? "both",
    adoptedChildIds: buildAdoptedChildIds(input),
    marriageUnitsByPerson: buildMarriageUnitsByPerson(input),
    kinshipEdges: buildKinshipRelationshipEdges(input),
  };

  const out: MutableOutput = {
    nodes: [],
    connectors: [],
    seenAncestorKeys: new Set(),
    warnings: [],
  };

  // 1) Cặp trung tâm (đời 0), đặt cạnh nhau nếu có cả 2, hoặc 1 mình nếu chỉ biết 1 người.
  let xA: number | null = null;
  let xB: number | null = null;

  if (personA && personB) {
    xA = -(NODE_WIDTH + SPOUSE_GAP / 2);
    xB = SPOUSE_GAP / 2;
  } else if (personA) {
    xA = -NODE_WIDTH / 2;
  } else if (personB) {
    xB = -NODE_WIDTH / 2;
  }

  if (personA && xA !== null) {
    out.nodes.push(makeNode(personA, xA, 0, "personA", "blood", 0, ctx));
  }
  if (personB && xB !== null) {
    out.nodes.push(makeNode(personB, xB, 0, "personB", "blood", 0, ctx));
    if (personA && xA !== null) {
      out.connectors.push(
        spouseConnector(
          xA + NODE_WIDTH,
          NODE_HEIGHT / 2,
          xB,
          NODE_HEIGHT / 2,
          getMarriageUnit(personA.id, personB.id, ctx)?.isEnded ?? false,
        ),
      );
    }
  }

  // 1b) Dòng họ: anh chị em ruột của personA/personB LUÔN hiện (không cần bật
  // "Dòng họ") — toả thêm ra bên trái/phải, cùng đời với cặp trung tâm. Bật
  // "Dòng họ" sẽ vẽ thêm vợ/chồng + con cháu của từng người trong số đó.
  //
  // QUAN TRỌNG: phải biết TRƯỚC bề rộng thật của cây con cháu (đời 1 trở
  // xuống) thì mới đặt anh chị em ở đúng vị trí không chồng lên cây đó — vì
  // cây con cháu có thể rất rộng nếu nhiều con/cháu. buildCoupleBlock thuần
  // (không side-effect, có nhớ đệm) nên tính trước ở đây không tốn gì thêm.
  const memo = new Map<string, CoupleBlock>();

  const coupleAnchorXForWidth =
    personA && xA !== null && personB && xB !== null
      ? (xA + NODE_WIDTH + xB) / 2
      : personA && xA !== null
        ? xA + NODE_WIDTH / 2
        : personB && xB !== null
          ? xB + NODE_WIDTH / 2
          : 0;

  const centerChildIds =
    personA && personB
      ? (getMarriageUnit(personA.id, personB.id, ctx)?.childIds ?? [])
      : personA
        ? (ctx.marriageUnitsByPerson.get(personA.id) ?? []).flatMap((u) => u.childIds)
        : personB
          ? (ctx.marriageUnitsByPerson.get(personB.id) ?? []).flatMap((u) => u.childIds)
          : [];

  const centerChildrenWidth = computeChildrenRowWidth(centerChildIds, 1, ctx, memo);
  const centerLeftExtent = coupleAnchorXForWidth - centerChildrenWidth / 2;
  const centerRightExtent = coupleAnchorXForWidth + centerChildrenWidth / 2;

  let gen0LeftExtent = xA ?? 0;
  let gen0RightExtent = xB !== null ? xB + NODE_WIDTH : 0;

  if (personA && xA !== null) {
    gen0LeftExtent = placeSiblingCluster({
      personId: personA.id,
      edgeX: Math.min(xA, centerLeftExtent),
      direction: "left",
      side: "personA",
      depth: 0,
      ctx,
      out,
      memo,
    });
  }
  if (personB && xB !== null) {
    gen0RightExtent = placeSiblingCluster({
      personId: personB.id,
      edgeX: Math.max(xB + NODE_WIDTH, centerRightExtent),
      direction: "right",
      side: "personB",
      depth: 0,
      ctx,
      out,
      memo,
    });
  }

  // 2) Tổ tiên: personA toả trái, personB toả phải — mỗi bên tự nhân đôi qua các đời.
  const topSlotHalfWidth = ANCESTOR_SLOT_UNIT * Math.pow(2, generationsUp - 1);

  if (personA && xA !== null) {
    fanAncestorsOf({
      anchorId: personA.id,
      anchorTopX: xA + NODE_WIDTH / 2,
      extraPush: Math.max(0, xA - gen0LeftExtent),
      side: "personA",
      slotHalfWidth: topSlotHalfWidth,
      direction: "left",
      branchFilter: ctx.branchFilter,
      ctx,
      out,
      memo,
    });
  }

  if (personB && xB !== null) {
    fanAncestorsOf({
      anchorId: personB.id,
      anchorTopX: xB + NODE_WIDTH / 2,
      extraPush: Math.max(0, gen0RightExtent - (xB + NODE_WIDTH)),
      side: "personB",
      slotHalfWidth: topSlotHalfWidth,
      direction: "right",
      branchFilter: ctx.branchFilter,
      ctx,
      out,
      memo,
    });
  }

  // 3) Con cháu: dùng đúng đơn vị hôn nhân của personA & personB (nếu có cả 2),
  // hoặc toàn bộ đơn vị hôn nhân của người còn lại (nếu chỉ có 1 người) — mỗi
  // đơn vị hôn nhân (mỗi cuộc hôn nhân) được vẽ thành 1 nhóm riêng, đúng kiểu
  // đa phu đa thê của Sơ đồ cây chính, thay vì gộp chung tất cả con lại.
  const coupleAnchorX = coupleAnchorXForWidth;

  if (centerChildIds.length === 0 && personA && personB) {
    out.warnings.push("Chưa tìm thấy con chung của 2 người trong dữ liệu.");
  } else if (centerChildIds.length > 0) {
    placeTopLevelChildrenRow({
      childIds: centerChildIds,
      depth: 1,
      parentAnchorX: coupleAnchorX,
      parentAnchorY: NODE_HEIGHT / 2,
      ctx,
      out,
      memo,
    });
  }

  return finalize(out, { x: coupleAnchorX, y: 0 }, personA, personB);
}

function fanAncestorsOf(args: {
  anchorId: string;
  anchorTopX: number;
  side: CoupleTreeSide;
  slotHalfWidth: number;
  direction: "left" | "right";
  ctx: BuildContext;
  out: MutableOutput;
  memo: Map<string, CoupleBlock>;
  /** chỉ toả 1 trong 2 nhánh (dùng cho vợ/chồng ở Sui gia khi muốn ẩn bớt 1 bên) */
  branchFilter?: "both" | "paternal" | "maternal";
  /** đẩy cả quạt tổ tiên ra xa thêm — dùng khi đời 0 (anh chị em của anchor) đã lấn ra xa hơn vị trí gốc của anchor */
  extraPush?: number;
}) {
  const { anchorId, anchorTopX, side, slotHalfWidth, direction, ctx, out, memo } = args;
  const branchFilter = args.branchFilter ?? "both";
  const extraPush = args.extraPush ?? 0;
  const { fatherId: rawFatherId, motherId: rawMotherId } = getDirectParents(
    anchorId,
    ctx.parentChildEdges,
    ctx.personsMap,
  );
  const fatherId = branchFilter === "maternal" ? null : rawFatherId;
  const motherId = branchFilter === "paternal" ? null : rawMotherId;
  // anchorTopAnchor LUÔN là vị trí THẬT của anchor (để đường nối luôn khớp);
  // chỉ vị trí XUẤT PHÁT của quạt (fanBaseX) mới bị đẩy ra xa thêm extraPush.
  const anchorTopAnchor = { x: anchorTopX, y: 0, personId: anchorId };
  const sign = direction === "left" ? -1 : 1;
  const fanBaseX = anchorTopX + sign * extraPush;

  // Cha & mẹ của anchor mỗi người đều cần trọn vẹn slotHalfWidth cho riêng mình
  // (để đủ chỗ nhân đôi tới generationsUp đời), nên xếp CẠNH NHAU không chồng
  // lấn, cả 2 đều lệch hẳn về phía `direction` — vì phía bên kia (personB) cũng
  // đang toả ngược chiều từ 1 anchor khác, không thể đối xứng quanh anchor này.
  const innerCenterX = fanBaseX + sign * slotHalfWidth;
  const outerCenterX = fanBaseX + sign * 3 * slotHalfWidth;

  let fatherCenter: { x: number; y: number } | null = null;
  let motherCenter: { x: number; y: number } | null = null;

  if (fatherId) {
    fatherCenter = placeAncestor({
      personId: fatherId,
      side,
      generation: 1,
      slotCenterX: innerCenterX,
      slotHalfWidth,
      childAnchor: anchorTopAnchor,
      ctx,
      out,
      memo,
    });
  }

  if (motherId) {
    motherCenter = placeAncestor({
      personId: motherId,
      side,
      generation: 1,
      slotCenterX: outerCenterX,
      slotHalfWidth,
      childAnchor: anchorTopAnchor,
      ctx,
      out,
      memo,
    });
  }

  if (fatherCenter && motherCenter) {
    out.connectors.push(
      spouseConnector(
        fatherCenter.x,
        fatherCenter.y,
        motherCenter.x,
        motherCenter.y,
        getMarriageUnit(fatherId!, motherId!, ctx)?.isEnded ?? false,
      ),
    );
  }
}

function placeAncestor(args: {
  personId: string;
  side: CoupleTreeSide;
  generation: number;
  slotCenterX: number;
  slotHalfWidth: number;
  childAnchor: { x: number; y: number; personId: string };
  ctx: BuildContext;
  out: MutableOutput;
  memo: Map<string, CoupleBlock>;
}): { x: number; y: number } | null {
  const { personId, side, generation, slotCenterX, slotHalfWidth, ctx, out, childAnchor, memo } = args;

  if (generation > ctx.generationsUp) return null;

  const person = ctx.personsMap.get(personId);
  if (!person) return null;

  const key = `${side}:${personId}:${generation}:${Math.round(slotCenterX)}`;
  if (out.seenAncestorKeys.has(key)) return null;
  out.seenAncestorKeys.add(key);

  const y = -generation * ROW_PITCH;
  const x = slotCenterX - NODE_WIDTH / 2;

  out.nodes.push(makeNode(person, x, y, side, "blood", -generation, ctx));
  out.connectors.push(
    descentConnector(
      x + NODE_WIDTH / 2,
      y + NODE_HEIGHT / 2,
      childAnchor.x,
      childAnchor.y,
      ctx.adoptedChildIds.has(childAnchor.personId),
    ),
  );

  const center = { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT / 2 };

  // Anh chị em của người này khi đang ở đời "ông bà" (generation 1) — LUÔN
  // hiện mặc định, mở rộng ra ngoài (cùng phía với side). Không lặp lại ở các
  // đời sâu hơn để tránh phá vỡ công thức nhân đôi bề rộng của quạt phả hệ.
  if (generation === 1) {
    const direction: "left" | "right" = side === "personA" ? "left" : "right";
    placeSiblingCluster({
      personId,
      edgeX: direction === "left" ? x : x + NODE_WIDTH,
      direction,
      side,
      depth: -generation,
      ctx,
      out,
      memo,
      capDescendantsAtSpouseOnly: true,
    });
  }

  if (generation < ctx.generationsUp) {
    const { fatherId, motherId } = getDirectParents(personId, ctx.parentChildEdges, ctx.personsMap);
    const nextHalf = slotHalfWidth / 2;
    const myTopAnchor = { x: x + NODE_WIDTH / 2, y, personId };

    let fatherCenter: { x: number; y: number } | null = null;
    let motherCenter: { x: number; y: number } | null = null;

    if (fatherId) {
      fatherCenter = placeAncestor({
        personId: fatherId,
        side,
        generation: generation + 1,
        slotCenterX: myTopAnchor.x - nextHalf,
        slotHalfWidth: nextHalf,
        childAnchor: myTopAnchor,
        ctx,
        out,
        memo,
      });
    }

    if (motherId) {
      motherCenter = placeAncestor({
        personId: motherId,
        side,
        generation: generation + 1,
        slotCenterX: myTopAnchor.x + nextHalf,
        slotHalfWidth: nextHalf,
        childAnchor: myTopAnchor,
        ctx,
        out,
        memo,
      });
    }

    if (fatherCenter && motherCenter) {
      out.connectors.push(
        spouseConnector(
          fatherCenter.x,
          fatherCenter.y,
          motherCenter.x,
          motherCenter.y,
          getMarriageUnit(fatherId!, motherId!, ctx)?.isEnded ?? false,
        ),
      );
    }
  }

  return center;
}

const UNIT_GROUP_GAP = VIET_MARRIAGE_GROUP_GAP;

function isHiddenSpouseId(spouseId: string, ctx: BuildContext): boolean {
  const spouse = ctx.personsMap.get(spouseId);
  if (!spouse) return false;
  if (ctx.hideDaughtersInLaw && spouse.gender === "female") return true;
  if (ctx.hideSonsInLaw && spouse.gender === "male") return true;
  return false;
}

interface CoupleBlockNode {
  personId: string;
  x: number; // cục bộ, tương đối so với gốc (0,0) của khối
  role: "blood" | "spouse";
}

interface CoupleBlockGroup {
  unit: MarriageUnit;
  /** vị trí (cục bộ) của nhẫn cưới + điểm xuất phát đường nối xuống con — CHÍNH LÀ tâm sinh học của các con, không phải tâm hình học */
  anchorX: number;
  spouseX: number | null;
  childSlots: { block: CoupleBlock; x: number }[];
}

/**
 * 1 khối cây con hoàn chỉnh, toạ độ CỤC BỘ (gốc tại x=0), giống hệt TreeBlock
 * của Sơ đồ cây chính: đệ quy dựng con TRƯỚC, suy vị trí vợ/chồng + bản thân
 * người này SAU (theo đúng tâm sinh học của con), rồi mới chuẩn hoá 1 lần.
 * Nhờ vậy khi caller dịch cả khối bằng 1 offset duy nhất, mọi thứ bên trong
 * (người, vợ/chồng, nhẫn cưới, đường nối, con cháu) luôn khớp nhau tuyệt đối —
 * không có chuyện đường nối "lạc" khỏi vị trí cha mẹ như cách làm cũ.
 */
interface CoupleBlock {
  nodes: CoupleBlockNode[];
  groups: CoupleBlockGroup[];
  width: number;
  /** tâm (cục bộ) của ô người chính trong khối — dùng để nối lên khối cha ở trên, hoặc canh giữa khi làm anh chị em */
  nodeTopCenterX: number;
}

function buildCoupleBlock(
  personId: string,
  depth: number,
  ctx: BuildContext,
  memo: Map<string, CoupleBlock>,
): CoupleBlock {
  const key = `${personId}:${depth}`;
  const cached = memo.get(key);
  if (cached) return cached;

  const person = ctx.personsMap.get(personId);
  if (!person) {
    const empty: CoupleBlock = { nodes: [], groups: [], width: NODE_WIDTH, nodeTopCenterX: NODE_WIDTH / 2 };
    memo.set(key, empty);
    return empty;
  }

  const units = ctx.marriageUnitsByPerson.get(personId) ?? [];

  if (units.length === 0) {
    const block: CoupleBlock = {
      nodes: [{ personId, x: 0, role: "blood" }],
      groups: [],
      width: NODE_WIDTH,
      nodeTopCenterX: NODE_WIDTH / 2,
    };
    memo.set(key, block);
    return block;
  }

  const canDescend = depth < ctx.generationsDown;

  // Bước 1: mỗi hôn nhân tự dựng hàng con của riêng nó (đệ quy) rồi tự tính
  // bề rộng + tâm sinh học của hàng con đó — CHƯA biết vị trí trong hàng các
  // hôn nhân, nên toạ độ vẫn ở khung cục bộ riêng của từng hôn nhân (gốc = 0).
  // Con RUỘT vẫn hiện dù ẩn dâu/rể (chỉ ẩn ô vợ/chồng, không xoá cả hôn nhân).
  const rawGroups = units.map((unit) => {
    const visibleSpouseId = unit.spouseId && !isHiddenSpouseId(unit.spouseId, ctx) ? unit.spouseId : null;

    const sortedChildren = canDescend
      ? sortVietnamesePeople(
          unit.childIds.map((id) => ctx.personsMap.get(id)).filter((p): p is Person => Boolean(p)),
        )
      : [];

    const childBlocks = sortedChildren.map((child) => buildCoupleBlock(child.id, depth + 1, ctx, memo));

    let cursor = 0;
    const childSlots = childBlocks.map((block) => {
      const x = cursor;
      cursor += block.width + SIBLING_GAP;
      return { block, x };
    });
    const childrenWidth = childBlocks.length > 0 ? cursor - SIBLING_GAP : 0;

    const childCenters = childSlots.map((slot) => slot.x + slot.block.nodeTopCenterX);
    const biologicalCenter =
      childCenters.length > 0 ? (Math.min(...childCenters) + Math.max(...childCenters)) / 2 : null;

    const spouseSlotWidth = visibleSpouseId ? NODE_WIDTH + SPOUSE_GAP : 0;
    const groupWidth = Math.max(childrenWidth, spouseSlotWidth, NODE_WIDTH);
    const anchorOffset = biologicalCenter ?? groupWidth / 2;

    return { unit, visibleSpouseId, childSlots, groupWidth, anchorOffset };
  });

  // Bước 2: xếp các hôn nhân cạnh nhau — đúng kiểu đa phu đa thê, mỗi hôn
  // nhân 1 khối riêng không chồng lấn, đủ rộng cho cả vợ/chồng lẫn con cháu.
  let groupCursor = 0;
  const groupOrigins: number[] = [];
  const groupAnchors: number[] = [];

  for (const g of rawGroups) {
    groupOrigins.push(groupCursor);
    groupAnchors.push(groupCursor + g.anchorOffset);
    groupCursor += g.groupWidth + UNIT_GROUP_GAP;
  }

  // Bước 3: suy vị trí vợ/chồng TỪ anchor của group (đã canh theo tâm sinh học
  // của con), rồi suy vị trí personId từ vị trí vợ/chồng đầu tiên — ĐÚNG THỨ TỰ
  // NGƯỢC lại so với cách làm trước đây (không suy con từ cha mẹ). Nếu vợ/chồng
  // bị ẩn, personId được canh giữa thẳng theo anchor (= tâm con ruột) luôn.
  const firstVisibleSpouseIndex = rawGroups.findIndex((g) => g.visibleSpouseId);
  let personX: number;

  if (firstVisibleSpouseIndex >= 0) {
    personX = groupAnchors[firstVisibleSpouseIndex] - SPOUSE_GAP / 2 - NODE_WIDTH;
  } else if (groupAnchors.length > 0) {
    personX = (Math.min(...groupAnchors) + Math.max(...groupAnchors)) / 2 - NODE_WIDTH / 2;
  } else {
    personX = 0;
  }

  const nodes: CoupleBlockNode[] = [{ personId, x: personX, role: "blood" }];
  const groups: CoupleBlockGroup[] = rawGroups.map((g, index) => {
    const anchorX = groupAnchors[index];
    let spouseX: number | null = null;

    if (g.visibleSpouseId) {
      spouseX = anchorX + SPOUSE_GAP / 2;
      nodes.push({ personId: g.visibleSpouseId, x: spouseX, role: "spouse" });
    }

    return {
      unit: g.unit,
      anchorX,
      spouseX,
      childSlots: g.childSlots.map((slot) => ({ block: slot.block, x: groupOrigins[index] + slot.x })),
    };
  });

  // Chuẩn hoá: dịch mọi thứ (người, group, con) để không có toạ độ âm — 1 LẦN
  // DUY NHẤT ở đây, chưa từng bị dịch lẻ tẻ ở bước nào trước đó.
  const allLefts = [
    ...nodes.map((n) => n.x),
    ...groups.flatMap((g) => g.childSlots.map((s) => s.x)),
  ];
  const minX = Math.min(0, ...allLefts);
  const shift = minX < 0 ? -minX : 0;

  const shiftedNodes = nodes.map((n) => ({ ...n, x: n.x + shift }));
  const shiftedGroups = groups.map((g) => ({
    unit: g.unit,
    anchorX: g.anchorX + shift,
    spouseX: g.spouseX !== null ? g.spouseX + shift : null,
    childSlots: g.childSlots.map((s) => ({ block: s.block, x: s.x + shift })),
  }));

  const maxRight = Math.max(
    NODE_WIDTH,
    ...shiftedNodes.map((n) => n.x + NODE_WIDTH),
    ...shiftedGroups.flatMap((g) => g.childSlots.map((s) => s.x + s.block.width)),
  );

  const personNode = shiftedNodes.find((n) => n.personId === personId)!;

  const block: CoupleBlock = {
    nodes: shiftedNodes,
    groups: shiftedGroups,
    width: maxRight,
    nodeTopCenterX: personNode.x + NODE_WIDTH / 2,
  };

  memo.set(key, block);
  return block;
}

/**
 * "In" 1 CoupleBlock (toạ độ cục bộ) ra toạ độ thật, bằng ĐÚNG 1 phép dịch
 * chuyển (offsetX, offsetY) — không tính toán lại vị trí gì thêm, nên không
 * thể xảy ra tình trạng đường nối lệch khỏi node như cách làm trước đây.
 */
function emitCoupleBlock(
  block: CoupleBlock,
  offsetX: number,
  offsetY: number,
  depth: number,
  ctx: BuildContext,
  out: MutableOutput,
  rootSide: CoupleTreeSide,
  rootRole: "blood" | "sibling" = "blood",
) {
  const bloodLocal = block.nodes.find((n) => n.role === "blood");

  for (const node of block.nodes) {
    const person = ctx.personsMap.get(node.personId);
    if (!person) continue;
    const role = node.role === "blood" ? rootRole : "spouse";
    out.nodes.push(makeNode(person, node.x + offsetX, offsetY, rootSide, role, depth, ctx));
  }

  for (const group of block.groups) {
    if (group.spouseX !== null && bloodLocal) {
      out.connectors.push(
        spouseConnector(
          bloodLocal.x + offsetX + NODE_WIDTH,
          offsetY + NODE_HEIGHT / 2,
          group.spouseX + offsetX,
          offsetY + NODE_HEIGHT / 2,
          group.unit.isEnded,
        ),
      );
    }

    for (const slot of group.childSlots) {
      const childOffsetX = offsetX + slot.x;
      const childOffsetY = offsetY + ROW_PITCH;

      emitCoupleBlock(slot.block, childOffsetX, childOffsetY, depth + 1, ctx, out, "descendant");

      const childBloodLocal = slot.block.nodes.find((n) => n.role === "blood");
      if (!childBloodLocal) continue;

      out.connectors.push(
        descentConnector(
          group.anchorX + offsetX,
          offsetY + NODE_HEIGHT / 2,
          childBloodLocal.x + childOffsetX + NODE_WIDTH / 2,
          childOffsetY,
          ctx.adoptedChildIds.has(childBloodLocal.personId),
        ),
      );
    }
  }
}

/** Đặt 1 hàng con ở cấp cao nhất (con chung của cặp trung tâm) — dùng CoupleBlock cho từng người rồi in ra cùng lúc. */
/** Tính trước bề rộng thật của 1 hàng con (không vẽ gì) — dùng để biết trước cây con cháu rộng bao nhiêu trước khi đặt anh chị em/tổ tiên. */
function computeChildrenRowWidth(
  childIds: string[],
  depth: number,
  ctx: BuildContext,
  memo: Map<string, CoupleBlock>,
): number {
  if (childIds.length === 0) return 0;
  const children = sortVietnamesePeople(
    childIds.map((id) => ctx.personsMap.get(id)).filter((p): p is Person => Boolean(p)),
  );
  if (children.length === 0) return 0;

  const blocks = children.map((child) => buildCoupleBlock(child.id, depth, ctx, memo));
  let cursor = 0;
  for (const block of blocks) cursor += block.width + SIBLING_GAP;
  return cursor - SIBLING_GAP;
}

function placeTopLevelChildrenRow(args: {
  childIds: string[];
  depth: number;
  parentAnchorX: number;
  parentAnchorY: number;
  ctx: BuildContext;
  out: MutableOutput;
  memo: Map<string, CoupleBlock>;
}) {
  const { childIds, depth, parentAnchorX, parentAnchorY, ctx, out, memo } = args;
  if (childIds.length === 0) return;

  const children = sortVietnamesePeople(
    childIds.map((id) => ctx.personsMap.get(id)).filter((p): p is Person => Boolean(p)),
  );
  if (children.length === 0) return;

  const blocks = children.map((child) => buildCoupleBlock(child.id, depth, ctx, memo));

  let cursor = 0;
  const slots = blocks.map((block) => {
    const x = cursor;
    cursor += block.width + SIBLING_GAP;
    return { block, x };
  });
  const totalWidth = cursor - SIBLING_GAP;

  const offsetBase = parentAnchorX - totalWidth / 2;
  const y = depth * ROW_PITCH;

  for (const slot of slots) {
    const offsetX = offsetBase + slot.x;
    emitCoupleBlock(slot.block, offsetX, y, depth, ctx, out, "descendant");

    const bloodLocal = slot.block.nodes.find((n) => n.role === "blood");
    if (!bloodLocal) continue;

    const childCenterX = offsetX + bloodLocal.x + NODE_WIDTH / 2;
    out.connectors.push(
      descentConnector(parentAnchorX, parentAnchorY, childCenterX, y, ctx.adoptedChildIds.has(bloodLocal.personId)),
    );
  }
}

function buildAdoptedChildIds(input: BuildCoupleTreeInput): Set<string> {
  const ids = new Set<string>();

  for (const row of input.familyChildren ?? []) {
    if (row.relationship_type === "adopted") ids.add(row.person_id);
  }

  for (const rel of input.relationships ?? []) {
    if (rel.type === "adopted_child") ids.add(rel.person_b);
  }

  return ids;
}

/**
 * Dựng danh sách "đơn vị hôn nhân" cho mỗi người: mỗi đơn vị = 1 vợ/chồng (hoặc
 * null nếu chưa rõ) + các con chung trong CHÍNH cuộc hôn nhân đó + tình trạng
 * (đang hôn nhân hay đã ly hôn/ly thân). Khác với buildSpouseEdges của bảng so
 * sánh (loại bỏ hẳn hôn nhân đã ly hôn), ở đây vẫn giữ lại để vẽ — chỉ đổi
 * kiểu đường nét khi ly hôn, giống cách Sơ đồ cây chính đang làm.
 *
 * Nguồn chính: family_parents + family_children (theo từng family_id).
 * Nguồn dự phòng: bảng relationships cũ, chỉ dùng cho phần chưa có trong
 * family tables (tránh trùng lặp khi 2 nguồn cùng mô tả 1 cặp/1 con).
 */
export function buildMarriageUnitsByPerson(input: BuildCoupleTreeInput): Map<string, MarriageUnit[]> {
  const familyById = new Map<string, FamilyRow>();
  for (const family of input.families ?? []) familyById.set(family.id, family);

  const activeFamilyIds = new Set(
    (input.families ?? []).filter((family) => !family.deleted_at).map((family) => family.id),
  );

  const parentsByFamily = new Map<string, string[]>();
  for (const parent of input.familyParents ?? []) {
    if (activeFamilyIds.size > 0 && !activeFamilyIds.has(parent.family_id)) continue;
    const arr = parentsByFamily.get(parent.family_id) ?? [];
    arr.push(parent.person_id);
    parentsByFamily.set(parent.family_id, arr);
  }

  const childrenByFamily = new Map<string, string[]>();
  for (const child of input.familyChildren ?? []) {
    if (activeFamilyIds.size > 0 && !activeFamilyIds.has(child.family_id)) continue;
    const arr = childrenByFamily.get(child.family_id) ?? [];
    arr.push(child.person_id);
    childrenByFamily.set(child.family_id, arr);
  }

  const unitsByPerson = new Map<string, MarriageUnit[]>();
  const coveredChildIds = new Set<string>();
  const coveredSpousePairs = new Set<string>();

  const pushUnit = (personId: string, unit: MarriageUnit) => {
    const arr = unitsByPerson.get(personId) ?? [];
    arr.push(unit);
    unitsByPerson.set(personId, arr);
  };

  for (const [familyId, parentIds] of parentsByFamily.entries()) {
    const family = familyById.get(familyId);
    const isEnded = family ? family.status === "divorced" || family.status === "separated" : false;
    const childIds = childrenByFamily.get(familyId) ?? [];
    childIds.forEach((id) => coveredChildIds.add(id));

    if (parentIds.length <= 1) {
      const soloParentId = parentIds[0];
      if (soloParentId) {
        pushUnit(soloParentId, { key: `family:${familyId}`, spouseId: null, childIds, isEnded });
      }
      continue;
    }

    for (let i = 0; i < parentIds.length; i += 1) {
      for (let j = 0; j < parentIds.length; j += 1) {
        if (i === j) continue;
        pushUnit(parentIds[i], {
          key: `family:${familyId}:${parentIds[j]}`,
          spouseId: parentIds[j],
          childIds,
          isEnded,
        });
      }
    }

    if (parentIds.length === 2) {
      coveredSpousePairs.add([parentIds[0], parentIds[1]].sort().join("<->"));
    }
  }

  // Dự phòng: hôn nhân chỉ có trong bảng relationships cũ, chưa có trong family tables.
  const legacyChildEdges = (input.relationships ?? []).filter(
    (rel) =>
      (rel.type === "biological_child" || rel.type === "adopted_child") &&
      !coveredChildIds.has(rel.person_b),
  );

  for (const rel of input.relationships ?? []) {
    if (rel.type !== "marriage") continue;
    const pairKey = [rel.person_a, rel.person_b].sort().join("<->");
    if (coveredSpousePairs.has(pairKey)) continue;
    coveredSpousePairs.add(pairKey);

    const isEnded = rel.status === "divorced" || rel.status === "separated";
    const sharedChildIds = legacyChildEdges
      .filter((childRel) => childRel.person_a === rel.person_a)
      .map((childRel) => childRel.person_b)
      .filter((childId) =>
        legacyChildEdges.some(
          (childRel2) => childRel2.person_a === rel.person_b && childRel2.person_b === childId,
        ),
      );

    sharedChildIds.forEach((id) => coveredChildIds.add(id));

    pushUnit(rel.person_a, { key: `legacy:${pairKey}`, spouseId: rel.person_b, childIds: sharedChildIds, isEnded });
    pushUnit(rel.person_b, { key: `legacy:${pairKey}`, spouseId: rel.person_a, childIds: sharedChildIds, isEnded });
  }

  // Con còn sót lại chưa gắn được với hôn nhân cụ thể nào (dữ liệu cũ, cha/mẹ đơn thân...).
  const orphanChildrenByParent = new Map<string, string[]>();
  for (const rel of legacyChildEdges) {
    if (coveredChildIds.has(rel.person_b)) continue;
    const arr = orphanChildrenByParent.get(rel.person_a) ?? [];
    arr.push(rel.person_b);
    orphanChildrenByParent.set(rel.person_a, arr);
  }
  for (const [parentId, childIds] of orphanChildrenByParent.entries()) {
    pushUnit(parentId, { key: `legacy-solo:${parentId}`, spouseId: null, childIds, isEnded: false });
  }

  return unitsByPerson;
}

function getMarriageUnit(personId: string, spouseId: string | null, ctx: BuildContext): MarriageUnit | null {
  const units = ctx.marriageUnitsByPerson.get(personId) ?? [];
  return units.find((unit) => unit.spouseId === spouseId) ?? null;
}

/** Anh chị em ruột của 1 người (cùng cha mẹ), dùng cho tuỳ chọn "Dòng họ". */
function getSiblingsOf(personId: string, ctx: BuildContext): Person[] {
  const { fatherId, motherId } = getDirectParents(personId, ctx.parentChildEdges, ctx.personsMap);
  if (!fatherId && !motherId) return [];

  const unit = fatherId
    ? getMarriageUnit(fatherId, motherId, ctx)
    : motherId
      ? getMarriageUnit(motherId, null, ctx)
      : null;

  const siblingIds = (unit?.childIds ?? []).filter((id) => id !== personId);
  const siblings = siblingIds
    .map((id) => ctx.personsMap.get(id))
    .filter((p): p is Person => Boolean(p));

  return sortVietnamesePeople(siblings);
}

/**
 * Đặt anh chị em ruột của 1 người thành 1 hàng nhỏ mở rộng ra phía
 * `direction`, cùng đời (cùng `depth`). Luôn hiện diện mặc định (không cần
 * bật "Dòng họ"). Khi bật "Dòng họ", mỗi người còn được vẽ thêm vợ/chồng +
 * con cháu của chính họ (dùng lại đúng buildCoupleBlock/emitCoupleBlock, đa phu đa thê như
 * phần con cháu chính, cũng canh giữa theo con ruột).
 */
function placeSiblingCluster(args: {
  personId: string;
  edgeX: number;
  direction: "left" | "right";
  side: CoupleTreeSide;
  depth: number;
  ctx: BuildContext;
  out: MutableOutput;
  memo: Map<string, CoupleBlock>;
  /** nếu true: con cháu của anh chị em này chỉ dừng ở vợ/chồng, không vẽ tiếp cháu — dùng cho đời ông bà vì con cháu của họ sẽ "rơi" xuống đúng hàng với đời cha mẹ/con cháu bên dưới, cần giới hạn để không chồng lấn */
  capDescendantsAtSpouseOnly?: boolean;
}): number {
  const { personId, edgeX, direction, side, depth, ctx, out } = args;
  const siblings = getSiblingsOf(personId, ctx);
  if (siblings.length === 0) return edgeX;

  const buildCtx: BuildContext = args.capDescendantsAtSpouseOnly ? { ...ctx, generationsDown: depth } : ctx;
  const buildMemo = args.capDescendantsAtSpouseOnly ? new Map<string, CoupleBlock>() : args.memo;

  const sign = direction === "left" ? -1 : 1;
  // Mở rộng ra ngoài theo đúng thứ tự sinh, người gần nhánh chính trước.
  const ordered = direction === "left" ? [...siblings].reverse() : siblings;

  let cursor = edgeX;
  const y = depth * ROW_PITCH;

  for (const sibling of ordered) {
    if (ctx.includeClan) {
      const block = buildCoupleBlock(sibling.id, depth, buildCtx, buildMemo);
      cursor += sign * SIBLING_GAP;
      const offsetX = direction === "left" ? cursor - block.width : cursor;
      emitCoupleBlock(block, offsetX, y, depth, ctx, out, side, "sibling");
      cursor += sign * block.width;
    } else {
      cursor += sign * SIBLING_GAP;
      const x = direction === "left" ? cursor - NODE_WIDTH : cursor;
      out.nodes.push(makeNode(sibling, x, y, side, "sibling", depth, ctx));
      cursor += sign * NODE_WIDTH;
    }
  }

  return cursor;
}

function toKinshipNode(person: Person): KinshipPersonNode {
  return {
    id: person.id,
    full_name: person.full_name,
    gender: person.gender,
    birth_year: person.birth_year,
    birth_order: person.birth_order,
    generation: person.generation,
    is_in_law: person.is_in_law,
  };
}

function computeAddressHint(target: Person, ctx: BuildContext): string | null {
  if (!ctx.addressingRoot) return null;
  if (ctx.addressingRoot.id === target.id) return "Người gốc";

  const result = computeKinship(
    toKinshipNode(ctx.addressingRoot),
    toKinshipNode(target),
    ctx.allPersons.map(toKinshipNode),
    ctx.kinshipEdges,
  );

  const term = result?.aCallsB?.trim();
  if (!term || term === "chưa xác định" || term === "họ hàng cùng nhánh") return null;
  return term.charAt(0).toUpperCase() + term.slice(1);
}

function makeNode(
  person: Person,
  x: number,
  y: number,
  side: CoupleTreeSide,
  role: CoupleTreeRole,
  generation: number,
  ctx: BuildContext,
): CoupleTreeNode {
  return {
    id: `${side}:${role}:${person.id}:${generation}:${Math.round(x)}`,
    person,
    x,
    y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    side,
    role,
    generation,
    birthOrder: person.birth_order ?? null,
    addressHint: computeAddressHint(person, ctx),
    isHighlighted: ctx.highlightPersonId === person.id,
  };
}

function spouseConnector(x1: number, y1: number, x2: number, y2: number, isEnded = false): CoupleTreeConnector {
  return { id: `spouse:${x1}:${y1}:${x2}:${y2}`, kind: "spouse", x1, y1, x2, y2, isEnded };
}

function descentConnector(x1: number, y1: number, x2: number, y2: number, dashed = false): CoupleTreeConnector {
  return { id: `descent:${x1}:${y1}:${x2}:${y2}`, kind: "descent", x1, y1, x2, y2, dashed };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function emptyLayout(warnings: string[]): CoupleTreeDiagramLayout {
  return {
    nodes: [],
    connectors: [],
    width: 0,
    height: 0,
    rootCenter: { x: 0, y: 0 },
    personA: null,
    personB: null,
    warnings,
  };
}

function finalize(
  out: MutableOutput,
  root: { x: number; y: number },
  personA: Person | null,
  personB: Person | null,
): CoupleTreeDiagramLayout {
  if (out.nodes.length === 0) {
    return emptyLayout(out.warnings.length > 0 ? out.warnings : ["Không có dữ liệu để vẽ sơ đồ."]);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of out.nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x + node.width);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + node.height);
  }

  const offsetX = CANVAS_PADDING - minX;
  const offsetY = CANVAS_PADDING - minY;

  const nodes = out.nodes.map((node) => ({ ...node, x: node.x + offsetX, y: node.y + offsetY }));
  const connectors = out.connectors.map((connector) => ({
    ...connector,
    x1: connector.x1 + offsetX,
    y1: connector.y1 + offsetY,
    x2: connector.x2 + offsetX,
    y2: connector.y2 + offsetY,
  }));

  return {
    nodes,
    connectors,
    width: maxX - minX + CANVAS_PADDING * 2,
    height: maxY - minY + CANVAS_PADDING * 2,
    rootCenter: { x: root.x + offsetX, y: root.y + offsetY },
    personA,
    personB,
    warnings: out.warnings,
  };
}
