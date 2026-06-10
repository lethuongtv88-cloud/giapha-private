import type { Person } from "@/types";
import type { InLawSide, LineageBranch } from "@/utils/tree/lineageComparison";

export type KinshipAddressRegion = "south" | "north" | "neutral";

export interface InLawAddressInput {
  person: Person;
  root: Person | null;
  spouse: Person | null;
  side: InLawSide | "center";
  branch: LineageBranch | "couple" | "descendant";
  generation: number;
  relationLabel: string;
  isInLaw?: boolean;
  region?: KinshipAddressRegion;
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function lower(value: string): string {
  return clean(value).toLocaleLowerCase("vi");
}

function parentTerm(gender: Person["gender"], region: KinshipAddressRegion): string {
  if (gender === "female") {
    if (region === "south") return "má";
    if (region === "north") return "mẹ";
    return "mẹ";
  }

  if (region === "south") return "ba";
  if (region === "north") return "bố";
  return "cha";
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

  return "trong gia đình chung";
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
  if (!value || isGenericRelationLabel(value)) return false;

  return [
    "ông cậu",
    "bà dì",
    "ông chú",
    "bà cô",
    "ông dượng",
    "bà thím",
    "bà mợ",
    "bà bác",
    "ông bác",
    "cậu",
    "dì",
    "chú",
    "thím",
    "mợ",
    "cô",
    "dượng",
    "bác",
    "anh rể",
    "chị dâu",
    "em rể",
    "em dâu",
    "cháu dâu",
    "cháu rể",
    "con dâu",
    "con rể",
    "cha vợ",
    "mẹ vợ",
    "cha chồng",
    "mẹ chồng",
    "ông sui",
    "bà sui",
    "anh vợ",
    "chị vợ",
    "em vợ",
    "anh chồng",
    "chị chồng",
    "em chồng",
  ].some((term) => value === term || value.startsWith(`${term} `) || value.includes(` ${term}`));
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
  if (suffix === "trong gia đình chung") return cleanTerm;
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

  // Bên ngoại trong tiếng Việt miền Nam ưu tiên Cậu/Dì, không dùng Chú/Bác ngoại.
  if (input.branch === "maternal" || label.includes("ngoại")) {
    if (label.includes("ông bác") || label.includes("ông chú")) return appendSideSuffix("Ông cậu ngoại", suffix);
    if (label.includes("bà bác") || label.includes("bà cô")) return appendSideSuffix("Bà dì ngoại", suffix);
    if (label === "bác" || label === "chú") return appendSideSuffix("Cậu", suffix);
    if (label === "cô") return appendSideSuffix("Dì", suffix);
  }

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
      if (label.includes("chị")) return appendSideSuffix("Anh rể", suffix);
      if (label.includes("em")) return appendSideSuffix("Em rể", suffix);
      if (label.includes("cháu")) return appendSideSuffix("Cháu rể", suffix);
    }
    if (person.gender === "female") return `Dâu ${suffix}`;
    if (person.gender === "male") return `Rể ${suffix}`;
    return `Phối ngẫu ${suffix}`;
  }

  if (input.generation <= -4) {
    if (person.gender === "female") return `bà kỵ ${suffix}`;
    if (person.gender === "male") return `ông kỵ ${suffix}`;
    return `kỵ ${suffix}`;
  }

  if (input.generation === -3) {
    if (person.gender === "female") return `bà cụ ${suffix}`;
    if (person.gender === "male") return `ông cụ ${suffix}`;
    return `cụ ${suffix}`;
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
    if (label.startsWith("cha")) return `${parentTerm("male", input.region ?? "south")} ${suffix}`;
    if (label.startsWith("mẹ")) return `${parentTerm("female", input.region ?? "south")} ${suffix}`;

    if (person.gender === "female") {
      if (label.includes("ngoại") || input.branch === "maternal") return `dì/cô ${suffix}`;
      return `cô/bác ${suffix}`;
    }

    if (person.gender === "male") {
      if (label.includes("ngoại") || input.branch === "maternal") return `cậu/bác ${suffix}`;
      return `chú/bác ${suffix}`;
    }

    return `cô/chú/bác/cậu/dì ${suffix}`;
  }

  if (input.generation === 0) {
    if (person.gender === "female") return `chị/em ${suffix}`;
    if (person.gender === "male") return `anh/em ${suffix}`;
    return `anh/chị/em ${suffix}`;
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
