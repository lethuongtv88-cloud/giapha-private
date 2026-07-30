import {
  getRelationshipPath,
  type KinshipPersonNode,
  type KinshipRelationshipEdge,
  type Step,
} from "../kinshipHelpers";

/**
 * RelationshipContext — Giai đoạn 2, Commit 3.
 *
 * Tách "dữ liệu cấu trúc của quan hệ" (ai là tổ tiên chung, chênh lệch vai
 * vế, ai là người rẽ nhánh, thứ tự sinh để so lớn/nhỏ...) ra khỏi việc RENDER
 * thành chữ ("bác"/"chú"/"cô"...). File này CHƯA render gì cả — chỉ tính
 * toán. Việc render sẽ nằm ở các rule set từ Commit 4 trở đi, dựa hoàn toàn
 * vào RelationshipContext thay vì tự đọc lại steps/people thô như code cũ
 * (kinshipHelpers.ts's termFromPath) đang làm.
 *
 * Không đổi hành vi computeKinship() hiện tại — đây là module hoàn toàn mới,
 * độc lập, chưa có ai gọi tới trong luồng hiển thị thật.
 *
 * QUY ƯỚC "level" (số đời chênh lệch):
 *   - U (ascendSteps)  = số bước "parent" liên tiếp từ root lên tổ tiên chung
 *   - D (descendSteps) = số bước "child" liên tiếp từ tổ tiên chung xuống target
 *   - level = D - U
 *     level < 0  → target thuộc vai vế BỀ TRÊN so với root (cha/ông/bác/chú/cô...)
 *     level > 0  → target thuộc vai vế BỀ DƯỚI (con/cháu/chắt...)
 *     level = 0  → cùng vai vế (anh/chị/em ruột hoặc anh chị em họ)
 *
 * QUY ƯỚC "connector": với bàng hệ (U>0 và D>0), connector là người ĐẦU TIÊN
 * rẽ khỏi đường trực hệ của root — tức con của tổ tiên chung nằm trên đường
 * đi tới target (bloodPeople[U+1]). Theo bản v3 mục 4: giới tính của
 * connector quyết định hệ Bác/Chú/Cô (nam) hay Cậu/Dì (nữ), KHÔNG phân biệt
 * nội/ngoại — và quyết định này áp dụng cho toàn bộ nhánh phía dưới
 * connector (D càng lớn thì càng random xuống con cháu của connector, nhưng
 * connector vẫn giữ nguyên).
 *
 * QUY ƯỚC "directAncestorAtConnectorLevel": tổ tiên trực hệ của root ở CÙNG
 * mức với connector (bloodPeople[U-1]) — dùng để so sánh thứ tự sinh
 * (birth_order) với connector, xác định nhánh lớn/nhỏ (vd: bà cô lớn hơn hay
 * nhỏ hơn ông nội).
 */

export interface RelationshipContext {
  /** Dữ liệu thô gốc, giữ lại để tiện tra cứu/so sánh khi cần. */
  raw: { steps: Step[]; people: KinshipPersonNode[] };

  /** Vợ/chồng ở đầu đường đi (ví dụ: tính quan hệ của "vợ của root" với target). */
  leadingSpouse: KinshipPersonNode | null;
  /** Vợ/chồng ở cuối đường đi (ví dụ: "chú của root" đã kết hôn -> vợ chú). */
  trailingSpouse: KinshipPersonNode | null;

  /** Phần đường đi thuần huyết thống, đã cắt bỏ vợ/chồng ở 2 đầu (nếu có). */
  bloodSteps: Step[];
  bloodPeople: KinshipPersonNode[];

  ascendSteps: number; // U
  descendSteps: number; // D
  level: number; // D - U

  /** true nếu bloodSteps toàn "parent" hoặc toàn "child" hoặc rỗng (mục 2: trực hệ). */
  isPureLineage: boolean;

  commonAncestor: KinshipPersonNode | null;
  connector: KinshipPersonNode | null;
  directAncestorAtConnectorLevel: KinshipPersonNode | null;
}

function splitBoundarySpouse(steps: Step[], people: KinshipPersonNode[]): {
  leadingSpouse: KinshipPersonNode | null;
  trailingSpouse: KinshipPersonNode | null;
  steps: Step[];
  people: KinshipPersonNode[];
} {
  let s = steps;
  let p = people;
  let leadingSpouse: KinshipPersonNode | null = null;
  let trailingSpouse: KinshipPersonNode | null = null;

  if (s.length > 0 && s[0] === "spouse") {
    leadingSpouse = p[1] ?? null;
    s = s.slice(1);
    p = p.slice(1);
  }

  if (s.length > 0 && s[s.length - 1] === "spouse") {
    trailingSpouse = p[p.length - 1] ?? null;
    s = s.slice(0, -1);
    p = p.slice(0, -1);
  }

  return { leadingSpouse, trailingSpouse, steps: s, people: p };
}

export function buildRelationshipContext(
  personA: KinshipPersonNode,
  personB: KinshipPersonNode,
  persons: KinshipPersonNode[],
  relationships: KinshipRelationshipEdge[],
): RelationshipContext | null {
  const path = getRelationshipPath(personA, personB, persons, relationships);
  if (!path) return null;

  const { leadingSpouse, trailingSpouse, steps: bloodSteps, people: bloodPeople } = splitBoundarySpouse(
    path.steps,
    path.people,
  );

  let ascendSteps = 0;
  while (ascendSteps < bloodSteps.length && bloodSteps[ascendSteps] === "parent") {
    ascendSteps++;
  }

  const remaining = bloodSteps.slice(ascendSteps);
  // QUAN TRỌNG: không được giả định "phần còn lại chỉ có thể toàn child".
  // Điều đó chỉ đúng khi có tổ tiên chung THẬT SỰ ở phía trên. Trường hợp
  // 2 người không kết hôn nhưng có con chung, đường ngắn nhất là "xuống
  // con rồi lên lại" (bloodSteps = ["child", "parent"]) — ascendSteps=0
  // nhưng phần còn lại KHÔNG phải toàn "child". Phải kiểm tra thật, không
  // suy đoán, nếu không sẽ nhận nhầm thành "cháu nội/ngoại" thuần tuý.
  const isValidUpThenDownShape = remaining.every((step) => step === "child");
  const descendSteps = isValidUpThenDownShape ? remaining.length : 0;
  const isPureLineage = isValidUpThenDownShape && (ascendSteps === 0 || descendSteps === 0);

  const commonAncestor = isValidUpThenDownShape ? bloodPeople[ascendSteps] ?? null : null;
  const connector = isValidUpThenDownShape && descendSteps > 0 ? bloodPeople[ascendSteps + 1] ?? null : null;
  const directAncestorAtConnectorLevel =
    isValidUpThenDownShape && ascendSteps > 0 ? bloodPeople[ascendSteps - 1] ?? null : null;

  return {
    raw: { steps: path.steps, people: path.people },
    leadingSpouse,
    trailingSpouse,
    bloodSteps,
    bloodPeople,
    ascendSteps,
    descendSteps,
    level: descendSteps - ascendSteps,
    isPureLineage,
    commonAncestor,
    connector,
    directAncestorAtConnectorLevel,
  };
}
