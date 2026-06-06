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

function generationTerm(input: InLawAddressInput): string {
  const label = lower(input.relationLabel);
  const person = input.person;
  const suffix = sideInLawSuffix(input);

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
    if (person.gender === "female") return `dâu ${suffix}`;
    if (person.gender === "male") return `rể ${suffix}`;
    return `phối ngẫu ${suffix}`;
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
  const term = generationTerm(input);
  const perspective = perspectiveLabel(input);

  if (input.branch === "couple") {
    return `Vai: ${term}.`;
  }

  if (input.branch === "descendant") {
    return `Gợi ý gọi: ${term}. Vai: hậu duệ chung của cặp vợ chồng.`;
  }

  return `Gợi ý gọi: ${term}. Vai: ${perspective}, ${input.relationLabel.toLocaleLowerCase("vi")}.`;
}
