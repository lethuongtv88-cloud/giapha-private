import type { Person } from "@/types";
import type { InLawSide, LineageBranch } from "@/utils/tree/lineageComparison";

export interface InLawAddressInput {
  person: Person;
  root: Person | null;
  spouse: Person | null;
  side: InLawSide | "center";
  branch: LineageBranch | "couple" | "descendant";
  generation: number;
  relationLabel: string;
  isInLaw?: boolean;
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function lower(value: string): string {
  return clean(value).toLocaleLowerCase("vi");
}

function parentTerm(gender: Person["gender"]): string {
  // Chốt: chỉ dùng 1 kiểu Nam Bộ cho cả 3 trang, không còn tuỳ chọn vùng miền.
  if (gender === "female") return "má";
  return "ba";
}

function sideInLawSuffix(input: InLawAddressInput): string {
  const root = input.root;

  if (input.side === "root") {
    if (root?.gender === "male") return "bên chồng";
    if (root?.gender === "female") return "bên vợ";
    return "bên người gốc";
  }

  if (input.side === "spouse") {
    if (root?.gender === "male") return "bên vợ";
    if (root?.gender === "female") return "bên chồng";
    return "bên vợ/chồng";
  }

  // side === "center": không có khung 2 họ để so sánh (trang Nội ngoại, hoặc
  // chính cặp gốc trong Sui gia) — không gắn hậu tố nào cả.
  return "";
}


const GENERIC_LABEL_PATTERNS = [
  "họ hàng cùng nhánh",
  "vợ của họ hàng cùng nhánh",
  "chồng của họ hàng cùng nhánh",
  "phối ngẫu của họ hàng cùng nhánh",
  "cùng hàng",
  "người gốc",
  "vợ/chồng",
];

function capitalizeVietnamese(value: string): string {
  const text = clean(value);
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase("vi") + text.slice(1);
}

function isGenericRelationLabel(label: string): boolean {
  const value = lower(label);
  return GENERIC_LABEL_PATTERNS.some((pattern) => value === pattern || value.includes(pattern));
}

function hasSpecificKinshipTerm(label: string): boolean {
  const value = lower(label);
  if (!value) return false;

  // computeKinship (utils/kinshipHelpers.ts) là nguồn tính danh xưng DUY NHẤT
  // cho cả 3 trang. Bất kỳ kết quả nào nó trả về đều được tin tưởng và dùng
  // trực tiếp, TRỪ khi đó là 1 trong các nhãn dự phòng chung chung
  // (isGenericRelationLabel) — ví dụ "Cùng hàng cha/mẹ", "Người gốc"...
  // Trước đây dùng danh sách trắng liệt kê từng từ (bác/chú/cô/cậu/dì...)
  // nên các từ hợp lệ nhưng không có trong danh sách (Mẹ, Cha, Bà mợ, Ông
  // dượng, Bà thím, Bà bác...) bị coi là "chưa cụ thể" và rơi vào nhánh đoán
  // mò, cho ra Dâu/Rể chung chung dù đã tính đúng.
  return !isGenericRelationLabel(value);
}

function stripInLawSideSuffix(label: string): string {
  return clean(label)
    .replace(/\s+bên\s+(vợ|chồng|người gốc|vợ\/chồng)$/iu, "")
    .replace(/\s+trong\s+gia\s+đình\s+chung$/iu, "")
    .trim();
}

function appendSideSuffix(term: string, suffix: string): string {
  const cleanTerm = capitalizeVietnamese(stripInLawSideSuffix(term));
  if (!cleanTerm) return cleanTerm;
  if (!suffix) return cleanTerm;
  const lowerTerm = lower(cleanTerm);
  const lowerSuffix = lower(suffix);
  if (lowerTerm.endsWith(lowerSuffix)) return cleanTerm;
  return `${cleanTerm} ${suffix}`;
}

function specificTermFromRelationLabel(input: InLawAddressInput): string | null {
  const suffix = sideInLawSuffix(input);
  const relation = stripInLawSideSuffix(input.relationLabel);
  const label = lower(relation);

  if (!label || isGenericRelationLabel(label)) return null;

  // Danh xưng cụ thể đã được `computeKinship` (utils/kinshipHelpers.ts) tính
  // đúng theo bản chốt hệ thống danh xưng chung (quy tắc 2 tầng bàng hệ, Chế/
  // Chị, đồng hao...). Không tự ý ép lại theo nội/ngoại ở đây nữa — tầng liền
  // kề ông/bà (ông bác/ông chú/bà cô/ông cậu/bà dì) không còn phân biệt nội/
  // ngoại, nên việc ép "bên ngoại luôn là cậu/dì" sẽ sai với quy tắc mới.
  if (hasSpecificKinshipTerm(relation)) return appendSideSuffix(relation, suffix);

  return null;
}

export function getInLawAddressDetail(input: InLawAddressInput): string {
  if (input.branch === "couple") {
    return `Vai: ${generationTerm(input)}.`;
  }

  if (input.branch === "descendant") {
    return "Vai: hậu duệ chung của cặp vợ chồng.";
  }

  return `Vai: ${perspectiveLabel(input)}, ${input.relationLabel.toLocaleLowerCase("vi")}.`;
}

function generationTerm(input: InLawAddressInput): string {
  return generationTermRaw(input).trim();
}

function generationTermRaw(input: InLawAddressInput): string {
  const label = lower(input.relationLabel);
  const person = input.person;
  const suffix = sideInLawSuffix(input);
  const specificTerm = specificTermFromRelationLabel(input);

  if (specificTerm) return specificTerm;

  if (input.branch === "couple") {
    if (input.spouse && person.id === input.spouse.id) {
      if (person.gender === "female") return "vợ";
      if (person.gender === "male") return "chồng";
      return "vợ/chồng";
    }
    if (input.root && person.id === input.root.id) return "người gốc";
    return "cặp gốc";
  }

  if (input.branch === "descendant") {
    if (input.generation === 1) return "con chung";
    if (input.generation === 2) return "cháu chung";
    if (input.generation === 3) return "chắt chung";
    if (input.generation === 4) return "chút chung";
    return `hậu duệ chung đời ${input.generation}`;
  }

  if (input.isInLaw) {
    if (label.includes("vợ của")) {
      if (label.includes("cậu")) return appendSideSuffix("Mợ", suffix);
      if (label.includes("chú")) return appendSideSuffix("Thím", suffix);
      if (label.includes("anh")) return appendSideSuffix("Chị dâu", suffix);
      if (label.includes("em")) return appendSideSuffix("Em dâu", suffix);
      if (label.includes("cháu")) return appendSideSuffix("Cháu dâu", suffix);
    }
    if (label.includes("chồng của")) {
      if (label.includes("cô") || label.includes("dì")) return appendSideSuffix(input.generation <= -2 ? "Ông dượng" : "Dượng", suffix);
      if (label.includes("chế")) return appendSideSuffix("Anh rể", suffix);
      if (label.includes("em")) return appendSideSuffix("Em rể", suffix);
      if (label.includes("cháu")) return appendSideSuffix("Cháu rể", suffix);
    }
    if (person.gender === "female") return `Dâu ${suffix}`;
    if (person.gender === "male") return `Rể ${suffix}`;
    return `Phối ngẫu ${suffix}`;
  }

  if (input.generation <= -4) {
    if (person.gender === "female") return `bà sơ ${suffix}`;
    if (person.gender === "male") return `ông sơ ${suffix}`;
    return `ông/bà sơ ${suffix}`;
  }

  if (input.generation === -3) {
    if (person.gender === "female") return `bà cố ${suffix}`;
    if (person.gender === "male") return `ông cố ${suffix}`;
    return `ông/bà cố ${suffix}`;
  }

  if (input.generation === -2) {
    if (label.includes("nội")) {
      if (person.gender === "female") return `bà nội ${suffix}`;
      if (person.gender === "male") return `ông nội ${suffix}`;
      return `ông/bà nội ${suffix}`;
    }
    if (label.includes("ngoại")) {
      if (person.gender === "female") return `bà ngoại ${suffix}`;
      if (person.gender === "male") return `ông ngoại ${suffix}`;
      return `ông/bà ngoại ${suffix}`;
    }
    if (person.gender === "female") return `bà ${suffix}`;
    if (person.gender === "male") return `ông ${suffix}`;
    return `ông/bà ${suffix}`;
  }

  if (input.generation === -1) {
    if (label.startsWith("cha")) return `${parentTerm("male")} ${suffix}`;
    if (label.startsWith("mẹ")) return `${parentTerm("female")} ${suffix}`;

    // Dự phòng khi computeKinship không xác định được (thiếu dữ liệu quan hệ):
    // bên ngoại vẫn chốt cậu/dì; bên nội mặc định bác/chú/cô (không rõ tuổi
    // nên để ngỏ bác/chú).
    if (input.branch === "maternal") {
      if (person.gender === "female") return `dì ${suffix}`;
      if (person.gender === "male") return `cậu ${suffix}`;
      return `cậu/dì ${suffix}`;
    }

    if (person.gender === "female") return `cô ${suffix}`;
    if (person.gender === "male") return `bác/chú ${suffix}`;
    return `cô/chú/bác ${suffix}`;
  }

  if (input.generation === 0) {
    if (person.gender === "female") return `chế/em ${suffix}`;
    if (person.gender === "male") return `anh/em ${suffix}`;
    return `anh/chế/em ${suffix}`;
  }

  if (input.generation === 1) return `con/cháu ${suffix}`;
  if (input.generation === 2) return `cháu ${suffix}`;
  if (input.generation === 3) return `chắt ${suffix}`;
  if (input.generation === 4) return `chút ${suffix}`;

  return `${input.relationLabel.toLocaleLowerCase("vi")} ${suffix}`;
}

function perspectiveLabel(input: InLawAddressInput): string {
  if (input.side === "root") {
    if (input.root?.gender === "male") return "Bên chồng của vợ";
    if (input.root?.gender === "female") return "Bên vợ của chồng";
    return "Bên người gốc";
  }

  if (input.side === "spouse") {
    if (input.root?.gender === "male") return "Bên vợ của người gốc";
    if (input.root?.gender === "female") return "Bên chồng của người gốc";
    return "Bên vợ/chồng";
  }

  return "Gia đình chung";
}

export function getInLawAddressSuggestion(input: InLawAddressInput): string {
  return generationTerm(input);
}
