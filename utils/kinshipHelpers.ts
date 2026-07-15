export interface KinshipPersonNode {
  id: string;
  full_name: string;
  gender: "male" | "female" | "other";
  birth_year: number | null;
  birth_order: number | null;
  generation: number | null;
  is_in_law: boolean;
}

export interface KinshipRelationshipEdge {
  type: string;
  person_a: string;
  person_b: string;
}

export interface KinshipResult {
  aCallsB: string;
  bCallsA: string;
  description: string;
  pathLabels: string[];
}

type Step = "parent" | "child" | "spouse";

interface DirectedEdge {
  to: string;
  step: Step;
}

interface PathNode {
  id: string;
  steps: Step[];
  personIds: string[];
}

function southernBirthOrderLabel(order?: number | null): string | null {
  if (order == null || !Number.isFinite(order) || order <= 0) return null;

  const labels = [
    "Hai",
    "Ba",
    "Tư",
    "Năm",
    "Sáu",
    "Bảy",
    "Tám",
    "Chín",
    "Mười",
    "Mười Một",
    "Mười Hai",
    "Mười Ba",
  ];

  // Nam Bộ gọi con đầu lòng là "Hai" (bỏ qua "Một"), nên labels[order-1] đã
  // là tên gọi đầy đủ tương ứng với birth_order — không cộng/gắn thêm "thứ"
  // ở đây nữa, việc đó do personName() đảm nhiệm khi hiển thị.
  return labels[order - 1] ?? `${order + 1}`;
}

function personName(person?: KinshipPersonNode | null): string {
  if (!person) return "người này";
  const order = southernBirthOrderLabel(person.birth_order);
  return order ? `${person.full_name} (${order})` : person.full_name;
}

function lineageSideFromRootParent(rootParent?: KinshipPersonNode | null): "nội" | "ngoại" | null {
  if (!rootParent) return null;
  return rootParent.gender === "female" ? "ngoại" : "nội";
}

function appendLineageSide(term: string, side: "nội" | "ngoại" | null): string {
  return side ? `${term} bên ${side}` : term;
}

function genderParentTerm(person?: KinshipPersonNode | null): string {
  if (person?.gender === "female") return "mẹ";
  if (person?.gender === "male") return "cha";
  return "cha/mẹ";
}

function genderChildTerm(person?: KinshipPersonNode | null): string {
  if (person?.gender === "female") return "con gái";
  if (person?.gender === "male") return "con trai";
  return "con";
}

function siblingTerm(target?: KinshipPersonNode | null, reference?: KinshipPersonNode | null): string {
  const gender = target?.gender;
  const older = isOlder(target, reference);

  // Quy ước: "Chế" dùng cho chị theo huyết thống (ruột lẫn họ); "Chị" chỉ dùng
  // trong cụm ghép "chị dâu" (xem spouseOfKinshipTerm).
  if (gender === "male") return older === true ? "anh" : older === false ? "em trai" : "anh/em trai";
  if (gender === "female") return older === true ? "chế" : older === false ? "em gái" : "chế/em gái";
  return older === true ? "anh/chế" : older === false ? "em" : "anh/chế/em";
}

function isOlder(a?: KinshipPersonNode | null, b?: KinshipPersonNode | null): boolean | null {
  if (!a || !b) return null;

  // Vai vế gia phả ưu tiên thứ tự sinh trong cùng gia đình. Ngày/năm sinh chỉ là
  // fallback khi chưa nhập thứ tự sinh. Điều này xử lý đúng trường hợp người nhỏ
  // tuổi hơn nhưng thuộc nhánh bác/cậu/dì lớn hơn.
  if (a.birth_order != null && b.birth_order != null && a.birth_order !== b.birth_order) {
    return a.birth_order < b.birth_order;
  }

  if (a.birth_year != null && b.birth_year != null && a.birth_year !== b.birth_year) {
    return a.birth_year < b.birth_year;
  }

  return null;
}

function normalizeTerm(value: string): string {
  return value
    .toLocaleLowerCase("vi")
    .replace(/[·,:;().]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sideOfSpouse(root?: KinshipPersonNode | null): "vợ" | "chồng" | "vợ/chồng" {
  if (root?.gender === "male") return "vợ";
  if (root?.gender === "female") return "chồng";
  return "vợ/chồng";
}

function parentInLawTerm(target?: KinshipPersonNode | null, root?: KinshipPersonNode | null): string {
  const side = sideOfSpouse(root);
  if (target?.gender === "male") return side === "vợ" ? "cha vợ" : side === "chồng" ? "cha chồng" : "cha vợ/chồng";
  if (target?.gender === "female") return side === "vợ" ? "mẹ vợ" : side === "chồng" ? "mẹ chồng" : "mẹ vợ/chồng";
  return side === "vợ" ? "cha/mẹ vợ" : side === "chồng" ? "cha/mẹ chồng" : "cha/mẹ vợ/chồng";
}

function spouseSiblingInLawTerm(input: {
  target?: KinshipPersonNode | null;
  spouse?: KinshipPersonNode | null;
  root?: KinshipPersonNode | null;
}): string {
  const { target, spouse, root } = input;
  const side = sideOfSpouse(root);
  const older = isOlder(target, spouse);
  const prefix = target?.gender === "female"
    ? older === true ? "chị" : older === false ? "em" : "chị/em"
    : target?.gender === "male"
      ? older === true ? "anh" : older === false ? "em" : "anh/em"
      : older === true ? "anh/chị" : older === false ? "em" : "anh/chị/em";

  if (side === "vợ") return `${prefix} vợ`;
  if (side === "chồng") return `${prefix} chồng`;
  return `${prefix} vợ/chồng`;
}

function childSpouseParentTerm(target?: KinshipPersonNode | null): string {
  if (target?.gender === "male") return "ông sui";
  if (target?.gender === "female") return "bà sui";
  return "sui gia";
}

function dongHaoTerm(input: {
  root?: KinshipPersonNode | null;
  target?: KinshipPersonNode | null;
  rootSpouse?: KinshipPersonNode | null;
  targetSpouse?: KinshipPersonNode | null;
}): string | null {
  const { root, target, rootSpouse, targetSpouse } = input;
  if (!root?.gender || root.gender !== target?.gender) return null;

  // So vai vế theo thứ tự sinh của vợ (cột chèo) hoặc của chồng (bạn dâu),
  // không so tuổi của chính 2 người đồng hao với nhau. Nếu vợ/chồng của mình
  // là người sinh trước, mình là bên "anh/chế" (lớn); sinh sau thì mình là
  // "em".
  const spouseOlder = isOlder(rootSpouse, targetSpouse);

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


function directAncestorTerm(steps: Step[], people: KinshipPersonNode[]): string | null {
  if (!steps.every((step) => step === "parent")) return null;

  const depth = steps.length;
  const firstParent = people[1];
  const target = people[depth];
  const side = lineageSideFromRootParent(firstParent);

  if (depth === 1) return genderParentTerm(target);

  if (depth === 2) {
    if (side === "ngoại") return target?.gender === "female" ? "bà ngoại" : "ông ngoại";
    return target?.gender === "female" ? "bà nội" : "ông nội";
  }

  if (depth === 3) {
    const base = target?.gender === "female" ? "bà cố" : target?.gender === "male" ? "ông cố" : "ông/bà cố";
    return appendLineageSide(base, side);
  }

  if (depth === 4) {
    const base = target?.gender === "female" ? "bà sơ" : target?.gender === "male" ? "ông sơ" : "ông/bà sơ";
    return appendLineageSide(base, side);
  }

  if (depth === 5) {
    // Đời -5: Ông sơ/Bà sơ là 2 người (vợ chồng), nên đời -5 = cha/mẹ ruột
    // của mỗi người đó — ghép "Cha/Mẹ" + tên đời -4 tương ứng thay vì đặt
    // tên riêng, theo bản chốt hệ thống danh xưng (mục 2).
    const depth4Ancestor = people[4];
    const depth4Term = depth4Ancestor?.gender === "female" ? "Bà sơ" : depth4Ancestor?.gender === "male" ? "Ông sơ" : "Ông/Bà sơ";
    const parentWord = genderParentTerm(target);
    const capitalizedParentWord = parentWord.charAt(0).toLocaleUpperCase("vi") + parentWord.slice(1);
    return appendLineageSide(`${capitalizedParentWord} ${depth4Term}`, side);
  }

  return appendLineageSide(`tổ đời trên ${depth}`, side);
}

function directDescendantTerm(steps: Step[], people: KinshipPersonNode[]): string | null {
  if (!steps.every((step) => step === "child")) return null;

  const depth = steps.length;
  const firstChild = people[1];
  const target = people[people.length - 1];

  if (depth === 1) return genderChildTerm(target);
  if (depth === 2) {
    if (firstChild?.gender === "male") return "cháu nội";
    if (firstChild?.gender === "female") return "cháu ngoại";
    return "cháu";
  }
  if (depth === 3) return "chắt";
  if (depth === 4) return "chút";
  if (depth === 5) return "chít";
  return `hậu duệ đời ${depth}`;
}

function parentSiblingTerm(input: {
  target?: KinshipPersonNode | null;
  parent?: KinshipPersonNode | null;
  sideParent?: KinshipPersonNode | null;
}): string {
  const { target, parent, sideParent } = input;
  const older = isOlder(target, parent);
  const side = sideParent?.gender === "female" ? "ngoại" : "nội";

  if (side === "ngoại") {
    // Theo cách gọi phổ biến ở Nam Bộ/Vietnamese family context: bên ngoại nam cùng hàng
    // cha/mẹ gọi chung là cậu, không tách chú/bác ngoại. Nữ bên ngoại gọi là dì.
    if (target?.gender === "male") return "cậu";
    if (target?.gender === "female") return "dì";
    return "cậu/dì";
  }

  if (target?.gender === "male") return older === true ? "bác" : "chú";
  if (target?.gender === "female") return "cô";
  return "bác/chú/cô";
}

function grandparentSiblingTerm(input: {
  target?: KinshipPersonNode | null;
  grandparent?: KinshipPersonNode | null;
}): string {
  const { target, grandparent } = input;
  const older = isOlder(target, grandparent);

  // Tầng liền kề tổ tiên trực hệ (anh chị em của ông/bà): xác định theo GIỚI
  // TÍNH người được nối tới (đi qua ông hay đi qua bà), KHÔNG phân biệt nội/
  // ngoại — theo bản chốt hệ thống danh xưng chung. Nội/ngoại chỉ áp dụng cho
  // trực hệ và cho tầng con cháu của những người này (xem parentSiblingTerm /
  // genericCollateralTerm).
  if (grandparent?.gender === "female") {
    if (target?.gender === "male") return "ông cậu";
    if (target?.gender === "female") return "bà dì";
    return "ông cậu/bà dì";
  }

  if (target?.gender === "male") return older === true ? "ông bác" : "ông chú";
  if (target?.gender === "female") return "bà cô";
  return "ông bác/ông chú/bà cô";
}

function childOfParentSiblingTerm(input: { target?: KinshipPersonNode | null; parentSibling?: KinshipPersonNode | null }): string {
  const { target, parentSibling } = input;
  if (target?.gender === "male") return parentSibling?.gender === "female" ? "anh/em con dì/cô" : "anh/em con bác/chú/cậu";
  if (target?.gender === "female") return parentSibling?.gender === "female" ? "chế/em con dì/cô" : "chế/em con bác/chú/cậu";
  return "anh/chế/em họ";
}

function sameGenerationCollateralTerm(input: {
  target?: KinshipPersonNode | null;
  rootBranch?: KinshipPersonNode | null;
  targetBranch?: KinshipPersonNode | null;
  rootParent?: KinshipPersonNode | null;
  degree?: number;
}): string {
  const { target, rootBranch, targetBranch } = input;
  // Theo bản chốt hệ thống danh xưng: anh chị em họ (mọi mức độ xa) chỉ dùng
  // hậu tố "họ" đơn giản, không phân biệt nội/ngoại và không thêm "xa" theo
  // độ xa — cả nhánh dùng chung 1 cách gọi theo thứ tự sinh của người tổ tiên
  // gốc của nhánh đó so với tổ tiên trực hệ tương ứng.
  const targetBranchOlder = isOlder(targetBranch, rootBranch);

  if (target?.gender === "male") {
    if (targetBranchOlder === true) return "anh họ";
    if (targetBranchOlder === false) return "em họ";
    return "anh/em họ";
  }

  if (target?.gender === "female") {
    if (targetBranchOlder === true) return "chế họ";
    if (targetBranchOlder === false) return "em họ";
    return "chế/em họ";
  }

  if (targetBranchOlder === true) return "anh/chế họ";
  if (targetBranchOlder === false) return "em họ";
  return "anh/chế/em họ";
}

function ancestorSiblingByDepthTerm(input: {
  target?: KinshipPersonNode | null;
  ancestorSiblingOf?: KinshipPersonNode | null;
  rootParent?: KinshipPersonNode | null;
  depth: number;
}): string {
  const { target, ancestorSiblingOf, rootParent, depth } = input;

  if (depth === 1) {
    return parentSiblingTerm({
      target,
      parent: ancestorSiblingOf,
      sideParent: rootParent,
    });
  }

  if (depth === 2) {
    return grandparentSiblingTerm({
      target,
      grandparent: ancestorSiblingOf,
    });
  }

  // Đời -3/-4: mở rộng đúng quy tắc tầng liền kề (qua ông/qua bà), gắn thêm
  // hậu tố đời cố/sơ tương ứng. Đời -5 trở lên: nhãn chung, không đặt tên
  // riêng (theo bản chốt hệ thống danh xưng, mục 3.3).
  if (depth === 3 || depth === 4) {
    const genLabel = depth === 3 ? "đời cố" : "đời sơ";
    const older = isOlder(target, ancestorSiblingOf);

    if (ancestorSiblingOf?.gender === "female") {
      if (target?.gender === "male") return `ông cậu ${genLabel}`;
      if (target?.gender === "female") return `bà dì ${genLabel}`;
      return `ông cậu/bà dì ${genLabel}`;
    }

    if (target?.gender === "male") return older === true ? `ông bác ${genLabel}` : `ông chú ${genLabel}`;
    if (target?.gender === "female") return `bà cô ${genLabel}`;
    return `ông bác/ông chú/bà cô ${genLabel}`;
  }

  return `họ hàng xa đời ${depth}`;
}

function descendantCollateralTerm(_depth: number): string {
  // Với nhánh bàng hệ, cách gọi thông dụng vẫn là “cháu” dù thấp hơn nhiều đời
  // so với người đang gọi. Direct descendant đã được xử lý riêng ở directDescendantTerm().
  return "cháu";
}

function genericCollateralTerm(steps: Step[], people: KinshipPersonNode[]): string | null {
  if (steps.length < 2) return null;

  let up = 0;
  while (up < steps.length && steps[up] === "parent") up += 1;
  let down = 0;
  while (up + down < steps.length && steps[up + down] === "child") down += 1;

  if (up === 0 || down === 0 || up + down !== steps.length) return null;

  const target = people[people.length - 1];
  const rootParent = people[1];

  // Target is an anh/chị/em of an ancestor of the root.
  // Examples:
  // parent -> parent -> child = sibling of parent: bác/cậu/dì/chú/cô.
  // parent -> parent -> parent -> child = sibling of grandparent: ông cậu ngoại, bà dì ngoại...
  if (down === 1 && up >= 2) {
    return ancestorSiblingByDepthTerm({
      target,
      ancestorSiblingOf: people[up - 1],
      rootParent,
      depth: up - 1,
    });
  }

  // Same generation collateral relatives: compare seniority by the branch directly under
  // the common ancestor, not by the person record itself. This matches Vietnamese vai vế:
  // con của anh/chị cha mẹ thường là anh/chị họ, con của em cha mẹ là em họ.
  if (up === down && up >= 2) {
    return sameGenerationCollateralTerm({
      target,
      rootBranch: people[up - 1],
      targetBranch: people[up + 1],
      rootParent,
      degree: up - 1,
    });
  }

  // Target is in an upper generation but not a direct sibling of the root's ancestor,
  // for example child of ông/bà's sibling. Keep a useful Vietnamese term instead of
  // falling back to “họ hàng cùng nhánh”.
  if (up > down) {
    const generationAbove = up - down;
    if (generationAbove === 1) {
      const side = rootParent?.gender === "female" ? "ngoại" : "nội";
      if (side === "ngoại") {
        if (target?.gender === "male") return "cậu";
        if (target?.gender === "female") return "dì";
        return "cậu/dì";
      }

      const ancestorBranch = people[up - 1];
      const targetBranch = people[up + 1];
      const targetBranchOlder = isOlder(targetBranch, ancestorBranch);
      if (target?.gender === "male") return targetBranchOlder === true ? "bác" : "chú";
      if (target?.gender === "female") return "cô";
      return "bác/chú/cô";
    }
    if (generationAbove === 2) {
      const side = rootParent?.gender === "female" ? "ngoại" : "nội";
      if (target?.gender === "male") return `ông họ ${side}`;
      if (target?.gender === "female") return `bà họ ${side}`;
      return `họ hàng hàng ông bà bên ${side}`;
    }
    return `họ hàng đời trên ${generationAbove}`;
  }

  // Target is in a lower generation collateral branch.
  return descendantCollateralTerm(down - up);
}


function spouseOfKinshipTerm(baseTerm: string, spouse?: KinshipPersonNode | null): string | null {
  const base = normalizeTerm(baseTerm);
  const spouseGender = spouse?.gender;

  // Giữ hậu tố "họ" (nếu có, từ anh chị em họ) để ghép đúng "Chị dâu họ /
  // Anh rể họ" thay vì rút gọn về "chị dâu/anh rể" như quan hệ ruột gần.
  const isHo = base.endsWith(" họ");
  const core = isHo ? base.slice(0, base.length - 3).trim() : base;
  const suffix = isHo ? " họ" : "";

  // Vợ/chồng của tổ tiên trực hệ (trường hợp chỉ nối được qua hôn nhân,
  // không có sẵn quan hệ cha/mẹ trực tiếp trong dữ liệu).
  if (core.includes("ông nội")) return spouseGender === "female" ? "bà nội" : null;
  if (core.includes("bà nội")) return spouseGender === "male" ? "ông nội" : null;
  if (core.includes("ông ngoại")) return spouseGender === "female" ? "bà ngoại" : null;
  if (core.includes("bà ngoại")) return spouseGender === "male" ? "ông ngoại" : null;
  if (core.includes("ông cố")) return spouseGender === "female" ? "bà cố" : null;
  if (core.includes("bà cố")) return spouseGender === "male" ? "ông cố" : null;
  if (core.includes("ông sơ")) return spouseGender === "female" ? "bà sơ" : null;
  if (core.includes("bà sơ")) return spouseGender === "male" ? "ông sơ" : null;

  if (spouseGender === "female") {
    if (core.includes("ông chú")) return `bà thím${suffix}`;
    if (core.includes("ông cậu")) return `bà mợ${suffix}`;
    if (core.includes("ông bác")) return `bà bác${suffix}`;
    if (core === "bác" || core.includes(" bác") || core.includes("bác ")) return `bác gái${suffix}`;
    if (core === "chú" || core.includes(" chú") || core.includes("chú ")) return `thím${suffix}`;
    if (core === "cậu" || core.includes(" cậu") || core.includes("cậu ")) return `mợ${suffix}`;

    if (core === "anh" || core.startsWith("anh ")) return `chị dâu${suffix}`;
    if (core === "em trai" || core === "em" || core.includes("em trai")) return `em dâu${suffix}`;
    if (core.includes("anh/em") || core.includes("anh chị em")) return `chị/em dâu${suffix}`;

    if (core === "con trai") return "con dâu";
    if (core === "cháu" || core.includes("cháu trai") || core.includes("cháu")) return "cháu dâu";
  }

  if (spouseGender === "male") {
    if (core.includes("bà cô")) return `ông dượng${suffix}`;
    if (core.includes("bà dì")) return `ông dượng${suffix}`;
    if (core === "cô" || core.includes(" cô") || core.includes("cô ")) return `dượng${suffix}`;
    if (core === "dì" || core.includes(" dì") || core.includes("dì ")) return `dượng${suffix}`;

    if (core === "chế" || core.startsWith("chế ")) return `anh rể${suffix}`;
    if (core === "em gái" || core === "em" || core.includes("em gái")) return `em rể${suffix}`;
    if (core.includes("chế/em") || core.includes("chị/em") || core.includes("anh chị em")) return `anh/em rể${suffix}`;

    if (core === "con gái") return "con rể";
    if (core === "cháu" || core.includes("cháu gái") || core.includes("cháu")) return "cháu rể";
  }

  return null;
}

function termFromPath(steps: Step[], people: KinshipPersonNode[]): string {
  const root = people[0];
  const target = people[people.length - 1];

  if (steps.length === 0) return "bản thân";
  if (steps.length === 1 && steps[0] === "spouse") return target?.gender === "female" ? "vợ" : target?.gender === "male" ? "chồng" : "vợ/chồng";

  // Sui gia / in-law patterns should be resolved before generic collateral fallback.
  // root -> spouse -> parent = cha/mẹ vợ/chồng.
  if (steps.length === 2 && steps[0] === "spouse" && steps[1] === "parent") {
    return parentInLawTerm(target, root);
  }

  // root -> spouse -> parent -> child = anh/chị/em vợ/chồng.
  if (steps.length === 3 && steps[0] === "spouse" && steps[1] === "parent" && steps[2] === "child") {
    return spouseSiblingInLawTerm({ target, spouse: people[1], root });
  }

  // root -> child -> spouse -> parent = ông/bà sui.
  if (steps.length === 3 && steps[0] === "child" && steps[1] === "spouse" && steps[2] === "parent") {
    return childSpouseParentTerm(target);
  }

  // Đồng hao: root -> vợ/chồng -> cha/mẹ chung -> anh/chị/em của vợ/chồng -> vợ/chồng của người đó.
  // 2 người đàn ông cùng lấy 2 chị em ruột = cột chèo; 2 người phụ nữ cùng lấy
  // 2 anh em ruột = chị em bạn dâu. So vai vế theo thứ tự sinh của vợ/chồng
  // mình, không phải tuổi của chính 2 người này.
  if (
    steps.length === 4 &&
    steps[0] === "spouse" &&
    steps[1] === "parent" &&
    steps[2] === "child" &&
    steps[3] === "spouse"
  ) {
    const dongHao = dongHaoTerm({ root, target, rootSpouse: people[1], targetSpouse: people[3] });
    if (dongHao) return dongHao;
  }

  // Mọi quan hệ còn lại bắt đầu bằng bước "vợ/chồng" (chưa khớp các mẫu sui
  // gia/đồng hao cụ thể ở trên): tính TOÀN BỘ quan hệ trong khung của vợ/
  // chồng trước (coi vợ/chồng là gốc), rồi mới gắn hậu tố "bên vợ/bên chồng"
  // ĐÚNG MỘT LẦN ở bước cuối cùng. Trước đây hậu tố bị gắn vào giữa chuỗi
  // tính toán khiến các bước sau (như spouseOfKinshipTerm để suy ra
  // mợ/thím/dượng) không nhận diện được danh xưng gốc, gây lỗi hiển thị
  // "Dâu/Rể bên vợ" chung chung thay vì "Mợ/Thím/Dượng bên vợ" chính xác.
  if (steps[0] === "spouse" && steps.length > 1) {
    const coreTerm = termFromPath(steps.slice(1), people.slice(1));
    const spouseSide = sideOfSpouse(root);

    // Tránh lặp chữ "bên" khi coreTerm đã có sẵn "bên nội"/"bên ngoại" (tổ
    // tiên trực hệ của vợ/chồng) — đổi thành "Ông cố bên vợ (nội)" thay vì
    // "Ông cố bên nội bên vợ".
    const noiNgoaiMatch = coreTerm.match(/^(.*)\s+bên\s+(nội|ngoại)$/u);
    if (noiNgoaiMatch) {
      return `${noiNgoaiMatch[1]} bên ${spouseSide} (${noiNgoaiMatch[2]})`;
    }

    return `${coreTerm} bên ${spouseSide}`;
  }

  // Spouse of a known relation: map to Vietnamese affinal terms before trying
  // collateral patterns, otherwise paths ending in spouse can be lost to generic labels.
  if (steps[steps.length - 1] === "spouse") {
    const base = termFromPath(steps.slice(0, -1), people.slice(0, -1));
    const mapped = spouseOfKinshipTerm(base, target);
    if (mapped) return mapped;
    if (target?.gender === "female") return `vợ của ${base}`;
    if (target?.gender === "male") return `chồng của ${base}`;
    return `vợ/chồng của ${base}`;
  }

  const ancestor = directAncestorTerm(steps, people);
  if (ancestor) return ancestor;

  const descendant = directDescendantTerm(steps, people);
  if (descendant) return descendant;

  // sibling: up parent, down child.
  if (steps.length === 2 && steps[0] === "parent" && steps[1] === "child") {
    return siblingTerm(target, people[0]);
  }

  // sibling of parent: up to grandparent, down to parent's sibling.
  if (steps.length === 3 && steps[0] === "parent" && steps[1] === "parent" && steps[2] === "child") {
    return parentSiblingTerm({ target, parent: people[1], sideParent: people[1] });
  }

  // sibling of grandparent: parent -> grandparent -> great-grandparent -> sibling of grandparent.
  if (
    steps.length === 4 &&
    steps[0] === "parent" &&
    steps[1] === "parent" &&
    steps[2] === "parent" &&
    steps[3] === "child"
  ) {
    return grandparentSiblingTerm({
      target,
      grandparent: people[2],
    });
  }

  // cousin: parent -> grandparent -> down to aunt/uncle -> down to cousin.
  if (
    steps.length === 4 &&
    steps[0] === "parent" &&
    steps[1] === "parent" &&
    steps[2] === "child" &&
    steps[3] === "child"
  ) {
    const branchBased = sameGenerationCollateralTerm({
      target,
      rootBranch: people[1],
      targetBranch: people[3],
      rootParent: people[1],
      degree: 1,
    });
    return branchBased || childOfParentSiblingTerm({ target, parentSibling: people[3] });
  }

  const collateral = genericCollateralTerm(steps, people);
  if (collateral) return collateral;

  if (steps.filter((step) => step === "parent").length > 0 && steps.filter((step) => step === "child").length > 0) {
    return "họ hàng xa cùng huyết thống";
  }

  return "chưa xác định";
}

function buildGraph(relationships: KinshipRelationshipEdge[]): Map<string, DirectedEdge[]> {
  const graph = new Map<string, DirectedEdge[]>();

  const push = (from: string, edge: DirectedEdge) => {
    const list = graph.get(from) ?? [];
    list.push(edge);
    graph.set(from, list);
  };

  for (const rel of relationships) {
    if (rel.type === "biological_child" || rel.type === "adopted_child") {
      push(rel.person_b, { to: rel.person_a, step: "parent" });
      push(rel.person_a, { to: rel.person_b, step: "child" });
      continue;
    }

    if (rel.type === "marriage") {
      push(rel.person_a, { to: rel.person_b, step: "spouse" });
      push(rel.person_b, { to: rel.person_a, step: "spouse" });
    }
  }

  return graph;
}

function findShortestPath(
  fromId: string,
  toId: string,
  relationships: KinshipRelationshipEdge[],
): PathNode | null {
  if (fromId === toId) return { id: fromId, steps: [], personIds: [fromId] };

  const graph = buildGraph(relationships);
  const queue: Array<PathNode & { score: number; spouseCount: number }> = [
    { id: fromId, steps: [], personIds: [fromId], score: 0, spouseCount: 0 },
  ];
  const best = new Map<string, number>([[fromId, 0]]);

  while (queue.length > 0) {
    queue.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.spouseCount !== b.spouseCount) return a.spouseCount - b.spouseCount;
      return a.steps.length - b.steps.length;
    });

    const current = queue.shift();
    if (!current) continue;
    if (current.id === toId) {
      return { id: current.id, steps: current.steps, personIds: current.personIds };
    }
    if (current.steps.length >= 10) continue;

    for (const edge of graph.get(current.id) ?? []) {
      if (current.personIds.includes(edge.to)) continue;

      // Prefer blood-line paths over spouse shortcuts. A spouse edge is still allowed,
      // but it has higher weight so “ông cậu/cháu” does not get hidden behind
      // a shorter in-law path when both paths exist.
      const edgeWeight = edge.step === "spouse" ? 4 : 1;
      const nextScore = current.score + edgeWeight;
      const known = best.get(edge.to);
      if (known != null && known <= nextScore) continue;

      best.set(edge.to, nextScore);
      queue.push({
        id: edge.to,
        steps: [...current.steps, edge.step],
        personIds: [...current.personIds, edge.to],
        score: nextScore,
        spouseCount: current.spouseCount + (edge.step === "spouse" ? 1 : 0),
      });
    }
  }

  return null;
}

function stepLabel(step: Step, from?: KinshipPersonNode | null, to?: KinshipPersonNode | null): string {
  if (step === "parent") return `${personName(from)} → ${genderParentTerm(to)}: ${personName(to)}`;
  if (step === "child") return `${personName(from)} → ${genderChildTerm(to)}: ${personName(to)}`;
  return `${personName(from)} → vợ/chồng: ${personName(to)}`;
}

function labelsForPath(path: PathNode, personsById: Map<string, KinshipPersonNode>): string[] {
  return path.steps.map((step, index) => {
    const from = personsById.get(path.personIds[index]);
    const to = personsById.get(path.personIds[index + 1]);
    return stepLabel(step, from, to);
  });
}

export function computeKinship(
  personA: KinshipPersonNode,
  personB: KinshipPersonNode,
  persons: KinshipPersonNode[],
  relationships: KinshipRelationshipEdge[],
): KinshipResult | null {
  if (personA.id === personB.id) return null;

  const personsById = new Map(persons.map((person) => [person.id, person]));
  const pathAB = findShortestPath(personA.id, personB.id, relationships);
  const pathBA = findShortestPath(personB.id, personA.id, relationships);

  if (!pathAB || !pathBA) {
    return {
      aCallsB: "chưa xác định",
      bCallsA: "chưa xác định",
      description: "Chưa tìm thấy đường quan hệ đủ gần trong dữ liệu hiện có.",
      pathLabels: [],
    };
  }

  const peopleAB = pathAB.personIds.map((id) => personsById.get(id)).filter(Boolean) as KinshipPersonNode[];
  const peopleBA = pathBA.personIds.map((id) => personsById.get(id)).filter(Boolean) as KinshipPersonNode[];
  const aCallsB = termFromPath(pathAB.steps, peopleAB);
  const bCallsA = termFromPath(pathBA.steps, peopleBA);

  return {
    aCallsB,
    bCallsA,
    description: `${personName(personA)} gọi ${personName(personB)} là ${aCallsB}; ${personName(personB)} gọi ${personName(personA)} là ${bCallsA}.`,
    pathLabels: labelsForPath(pathAB, personsById),
  };
}
