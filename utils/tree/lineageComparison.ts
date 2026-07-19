import type { Person, Relationship } from "@/types";
import { computeKinship } from "@/utils/kinshipHelpers";
import type {
  FamilyChildRow,
  FamilyParentRow,
  FamilyRow,
} from "@/services/statistics/globalStats.service";
import {
  getInLawAddressDetail,
  getInLawAddressSuggestion,
} from "@/utils/kinship/inLawAddressing";

export type LineageBranch = "paternal" | "maternal";
export type InLawSide = "root" | "spouse";

export interface LineageDisplayOptions {
  /** Khi bật, thêm người cùng hàng trong dòng họ: anh em, cô/chú/bác/cậu/dì, con cháu cùng nhánh. */
  includeClan: boolean;
  /** Ẩn nữ phối ngẫu đi vào dòng họ qua hôn nhân: vợ/con dâu/chị em dâu/thím/mợ... */
  hideDaughtersInLaw: boolean;
  /** Ẩn nam phối ngẫu đi vào dòng họ qua hôn nhân: chồng/con rể/anh em rể/dượng... */
  hideSonsInLaw: boolean;
}

export interface LineagePersonItem {
  person: Person;
  generation: number;
  branch: LineageBranch | "center";
  relationLabel: string;
  addressHint?: string;
  note?: string;
  isInLaw?: boolean;
}

export interface LineageGenerationRow {
  generation: number;
  label: string;
  paternal: LineagePersonItem[];
  center: LineagePersonItem[];
  maternal: LineagePersonItem[];
}

export interface LineageComparisonResult {
  root: Person | null;
  father: Person | null;
  mother: Person | null;
  rows: LineageGenerationRow[];
  warnings: string[];
}

export interface InLawPersonItem {
  person: Person;
  generation: number;
  side: InLawSide | "center";
  branch: LineageBranch | "couple" | "descendant";
  relationLabel: string;
  addressHint: string;
  note?: string;
  isInLaw?: boolean;
}

export interface InLawGenerationRow {
  generation: number;
  label: string;
  rootPaternal: InLawPersonItem[];
  rootMaternal: InLawPersonItem[];
  couple: InLawPersonItem[];
  spousePaternal: InLawPersonItem[];
  spouseMaternal: InLawPersonItem[];
}

export interface InLawComparisonResult {
  root: Person | null;
  spouses: Person[];
  selectedSpouse: Person | null;
  rows: InLawGenerationRow[];
  warnings: string[];
}

export interface LineageInput {
  rootPersonId: string;
  persons: Person[];
  relationships?: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
  generationsUp?: number;
  generationsDown?: number;
  displayOptions?: Partial<LineageDisplayOptions>;
}

export interface InLawInput extends LineageInput {
  spousePersonId?: string | null;
}

interface ParentChildEdge {
  parentId: string;
  childId: string;
}

interface SpouseEdge {
  personA: string;
  personB: string;
}

interface CollectedPerson {
  personId: string;
  generation: number;
}

interface GraphContext {
  personsMap: Map<string, Person>;
  parentChildEdges: ParentChildEdge[];
  spouseEdges: SpouseEdge[];
  parentsByChild: Map<string, string[]>;
  childrenByParent: Map<string, string[]>;
  spousesByPerson: Map<string, string[]>;
}

const DEFAULT_DISPLAY_OPTIONS: LineageDisplayOptions = {
  includeClan: false,
  hideDaughtersInLaw: false,
  hideSonsInLaw: false,
};

function normalizeDisplayOptions(options?: Partial<LineageDisplayOptions>): LineageDisplayOptions {
  return { ...DEFAULT_DISPLAY_OPTIONS, ...(options ?? {}) };
}

function getPersonName(person: Person): string {
  return person.full_name || person.id;
}

function sortPersons<T extends { person: Person; generation: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.generation !== b.generation) return a.generation - b.generation;

    const birthA = a.person.birth_year ?? 9999;
    const birthB = b.person.birth_year ?? 9999;
    if (birthA !== birthB) return birthA - birthB;

    return getPersonName(a.person).localeCompare(getPersonName(b.person), "vi");
  });
}


function relationFromRoot(input: {
  root: Person | null;
  target: Person;
  persons: Person[];
  relationships?: Relationship[];
  fallback: string;
}): string {
  if (!input.root || input.root.id === input.target.id) return input.fallback;

  const result = computeKinship(
    {
      id: input.root.id,
      full_name: input.root.full_name,
      gender: input.root.gender,
      birth_year: input.root.birth_year,
      birth_order: input.root.birth_order,
      generation: input.root.generation,
      is_in_law: input.root.is_in_law,
    },
    {
      id: input.target.id,
      full_name: input.target.full_name,
      gender: input.target.gender,
      birth_year: input.target.birth_year,
      birth_order: input.target.birth_order,
      generation: input.target.generation,
      is_in_law: input.target.is_in_law,
    },
    input.persons.map((person) => ({
      id: person.id,
      full_name: person.full_name,
      gender: person.gender,
      birth_year: person.birth_year,
      birth_order: person.birth_order,
      generation: person.generation,
      is_in_law: person.is_in_law,
    })),
    (input.relationships ?? []).map((relationship) => ({
      type: relationship.type,
      person_a: relationship.person_a,
      person_b: relationship.person_b,
    })),
  );

  const term = result?.aCallsB?.trim();
  if (!term || term === "chưa xác định" || term === "họ hàng cùng nhánh") return input.fallback;
  return term.charAt(0).toUpperCase() + term.slice(1);
}

function applyRootKinshipLabels(input: {
  root: Person | null;
  persons: Person[];
  relationships?: Relationship[];
  items: LineagePersonItem[];
}): LineagePersonItem[] {
  return input.items.map((item) => {
    const relationLabel = relationFromRoot({
      root: input.root,
      target: item.person,
      persons: input.persons,
      relationships: input.relationships,
      fallback: item.relationLabel,
    });

    // Dùng chung 1 bộ xưng hô (utils/kinship/inLawAddressing.ts) cho cả 3 hệ
    // thống (Tra cứu danh xưng, Nội ngoại, Sui gia) để luôn ra cùng kết quả
    // khi tra cùng một người.
    const hint =
      item.branch === "center" && item.generation === 0
        ? "Người đang chọn"
        : getInLawAddressSuggestion({
            person: item.person,
            root: input.root,
            spouse: null,
            side: "center",
            branch: item.branch === "center" ? "descendant" : item.branch,
            generation: item.generation,
            relationLabel,
            isInLaw: item.isInLaw,
          });

    return {
      ...item,
      relationLabel,
      addressHint: hint,
    };
  });
}

function applyRootKinshipLabelsForInLaw(input: {
  root: Person | null;
  persons: Person[];
  relationships?: Relationship[];
  items: InLawPersonItem[];
}): InLawPersonItem[] {
  return input.items.map((item) => ({
    ...item,
    relationLabel: relationFromRoot({
      root: input.root,
      target: item.person,
      persons: input.persons,
      relationships: input.relationships,
      fallback: item.relationLabel,
    }),
  }));
}

function generationLabel(generation: number): string {
  if (generation < 0) {
    if (generation === -1) return "-1 · Cha mẹ / cùng hàng cha mẹ";
    if (generation === -2) return "-2 · Ông bà";
    if (generation === -3) return "-3 · Ông bà cố";
    if (generation === -4) return "-4 · Ông bà sơ";
    return `${generation} · Tổ đời ${Math.abs(generation)}`;
  }

  if (generation === 0) return "0 · Người gốc / cùng hàng";
  if (generation === 1) return "+1 · Con";
  if (generation === 2) return "+2 · Cháu";
  if (generation === 3) return "+3 · Chắt";
  if (generation === 4) return "+4 · Chút";
  return `+${generation} · Hậu duệ đời ${generation}`;
}

function branchAncestorLabel(input: {
  branch: LineageBranch;
  generation: number;
  person: Person;
  owner?: "root" | "spouse";
}): string {
  const { branch, generation, person, owner = "root" } = input;
  const sideSuffix = owner === "spouse" ? " bên vợ/chồng" : "";

  if (generation === -1) return branch === "paternal" ? `Cha${sideSuffix}` : `Mẹ${sideSuffix}`;

  if (generation === -2) {
    if (branch === "paternal") return person.gender === "female" ? `Bà nội${sideSuffix}` : `Ông nội${sideSuffix}`;
    return person.gender === "female" ? `Bà ngoại${sideSuffix}` : `Ông ngoại${sideSuffix}`;
  }

  if (generation === -3) return branch === "paternal" ? `Ông/bà cố bên nội${sideSuffix}` : `Ông/bà cố bên ngoại${sideSuffix}`;
  if (generation === -4) return branch === "paternal" ? `Ông/bà sơ bên nội${sideSuffix}` : `Ông/bà sơ bên ngoại${sideSuffix}`;

  return branch === "paternal"
    ? `Tổ đời ${Math.abs(generation)} bên nội${sideSuffix}`
    : `Tổ đời ${Math.abs(generation)} bên ngoại${sideSuffix}`;
}

function descendantLabel(generation: number): string {
  if (generation === 1) return "Con";
  if (generation === 2) return "Cháu";
  if (generation === 3) return "Chắt";
  if (generation === 4) return "Chút";
  return `Hậu duệ đời ${generation}`;
}

function sameGenerationLabel(generation: number): string {
  if (generation === -1) return "Cùng hàng cha/mẹ";
  if (generation === 0) return "Cùng hàng người gốc";
  if (generation > 0) return `Cùng hàng ${descendantLabel(generation).toLowerCase()}`;
  return `Cùng hàng đời ${generation}`;
}

function spouseLabel(spouse: Person, bloodPerson: Person): string {
  if (spouse.gender === "female") return `Dâu / vợ của ${getPersonName(bloodPerson)}`;
  if (spouse.gender === "male") return `Rể / chồng của ${getPersonName(bloodPerson)}`;
  return `Phối ngẫu của ${getPersonName(bloodPerson)}`;
}

function addressHint(item: { branch: LineageBranch | "couple" | "descendant"; generation: number; relationLabel: string; isInLaw?: boolean }): string {
  if (item.isInLaw) return `Theo hôn nhân: ${item.relationLabel.toLowerCase()}`;
  if (item.branch === "couple") return "Cặp gốc để so vai vế";
  if (item.branch === "descendant") return "Hậu duệ chung, xưng theo đời con/cháu";
  if (item.generation < 0) return `Thường gọi: ${item.relationLabel.toLowerCase()}`;
  return item.relationLabel;
}

function applyInLawAddressHints(
  items: InLawPersonItem[],
  root: Person | null,
  spouse: Person | null,
): InLawPersonItem[] {
  return items.map((item) => {
    const addressInput = {
      person: item.person,
      root,
      spouse,
      side: item.side,
      branch: item.branch,
      generation: item.generation,
      relationLabel: item.relationLabel,
      isInLaw: item.isInLaw,
    } as const;

    return {
      ...item,
      addressHint: getInLawAddressSuggestion(addressInput),
      note: item.note ?? getInLawAddressDetail(addressInput),
    };
  });
}

function shouldShowInLaw(person: Person, options: LineageDisplayOptions): boolean {
  if (person.gender === "female" && options.hideDaughtersInLaw) return false;
  if (person.gender === "male" && options.hideSonsInLaw) return false;
  return true;
}

function createContext(input: LineageInput): GraphContext {
  const personsMap = new Map(input.persons.map((person) => [person.id, person]));
  const parentChildEdges = buildParentChildEdges(input);
  const spouseEdges = buildSpouseEdges(input);
  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  const spousesByPerson = new Map<string, string[]>();

  for (const edge of parentChildEdges) {
    const parents = parentsByChild.get(edge.childId) ?? [];
    parents.push(edge.parentId);
    parentsByChild.set(edge.childId, parents);

    const children = childrenByParent.get(edge.parentId) ?? [];
    children.push(edge.childId);
    childrenByParent.set(edge.parentId, children);
  }

  for (const edge of spouseEdges) {
    const a = spousesByPerson.get(edge.personA) ?? [];
    a.push(edge.personB);
    spousesByPerson.set(edge.personA, a);

    const b = spousesByPerson.get(edge.personB) ?? [];
    b.push(edge.personA);
    spousesByPerson.set(edge.personB, b);
  }

  return {
    personsMap,
    parentChildEdges,
    spouseEdges,
    parentsByChild,
    childrenByParent,
    spousesByPerson,
  };
}

export function buildLineageComparison(input: LineageInput): LineageComparisonResult {
  const generationsUp = input.generationsUp ?? 4;
  const generationsDown = input.generationsDown ?? 4;
  const displayOptions = normalizeDisplayOptions(input.displayOptions);
  const ctx = createContext(input);
  const root = ctx.personsMap.get(input.rootPersonId) ?? null;
  const warnings: string[] = [];

  if (!root) {
    return {
      root: null,
      father: null,
      mother: null,
      rows: createLineageRows(generationsUp, generationsDown, [], [], []),
      warnings: [`Không tìm thấy người gốc: ${input.rootPersonId}`],
    };
  }

  const { fatherId, motherId } = getDirectParents(input.rootPersonId, ctx.parentChildEdges, ctx.personsMap);
  const father = fatherId ? ctx.personsMap.get(fatherId) ?? null : null;
  const mother = motherId ? ctx.personsMap.get(motherId) ?? null : null;

  if (!father) warnings.push("Người gốc chưa có cha trong dữ liệu.");
  if (!mother) warnings.push("Người gốc chưa có mẹ trong dữ liệu.");

  const paternal = fatherId
    ? displayOptions.includeClan
      ? collectBranchClanLineage({
          branchRootId: fatherId,
          rootPersonId: input.rootPersonId,
          branch: "paternal",
          owner: "root",
          ctx,
          generationsUp,
          generationsDown,
          displayOptions,
        })
      : collectDirectBranchAncestors({
          branchRootId: fatherId,
          branch: "paternal",
          owner: "root",
          ctx,
          generationsUp,
        })
    : [];

  const maternal = motherId
    ? displayOptions.includeClan
      ? collectBranchClanLineage({
          branchRootId: motherId,
          rootPersonId: input.rootPersonId,
          branch: "maternal",
          owner: "root",
          ctx,
          generationsUp,
          generationsDown,
          displayOptions,
        })
      : collectDirectBranchAncestors({
          branchRootId: motherId,
          branch: "maternal",
          owner: "root",
          ctx,
          generationsUp,
        })
    : [];

  const center: LineagePersonItem[] = [
    {
      person: root,
      generation: 0,
      branch: "center",
      relationLabel: "Người gốc",
    },
    ...collectDescendants(input.rootPersonId, ctx.parentChildEdges, generationsDown)
      .map((node): LineagePersonItem | null => {
        const person = ctx.personsMap.get(node.personId);
        if (!person) return null;
        return {
          person,
          generation: node.generation,
          branch: "center",
          relationLabel: descendantLabel(node.generation),
        };
      })
      .filter((item): item is LineagePersonItem => Boolean(item)),
  ];

  if (displayOptions.includeClan) {
    for (const item of collectSpousesForItems(center, ctx, displayOptions, "center")) {
      center.push(item);
    }
  }

  const labeledPaternal = applyRootKinshipLabels({
    root,
    persons: input.persons,
    relationships: input.relationships,
    items: paternal,
  });
  const labeledMaternal = applyRootKinshipLabels({
    root,
    persons: input.persons,
    relationships: input.relationships,
    items: maternal,
  });

  return {
    root,
    father,
    mother,
    rows: createLineageRows(generationsUp, generationsDown, labeledPaternal, center, labeledMaternal),
    warnings,
  };
}

export function buildInLawComparison(input: InLawInput): InLawComparisonResult {
  const generationsUp = input.generationsUp ?? 3;
  const generationsDown = input.generationsDown ?? 3;
  const displayOptions = normalizeDisplayOptions(input.displayOptions);
  const ctx = createContext(input);
  const root = ctx.personsMap.get(input.rootPersonId) ?? null;
  const warnings: string[] = [];

  if (!root) {
    return {
      root: null,
      spouses: [],
      selectedSpouse: null,
      rows: createInLawRows(generationsUp, generationsDown, [], [], [], [], []),
      warnings: [`Không tìm thấy người gốc: ${input.rootPersonId}`],
    };
  }

  const spouses = getSpouses(input.rootPersonId, ctx.spouseEdges, ctx.personsMap);
  const selectedSpouse =
    (input.spousePersonId ? ctx.personsMap.get(input.spousePersonId) ?? null : null) ?? spouses[0] ?? null;

  if (spouses.length === 0) {
    warnings.push("Người được chọn chưa có vợ/chồng hiện hành trong dữ liệu.");
  }

  const rootLineage = collectTwoBranchLineage({
    ownerId: input.rootPersonId,
    rootPersonId: input.rootPersonId,
    owner: "root",
    ctx,
    generationsUp,
    generationsDown,
    displayOptions,
  });

  const spouseLineage = selectedSpouse
    ? collectTwoBranchLineage({
        ownerId: selectedSpouse.id,
        rootPersonId: selectedSpouse.id,
        owner: "spouse",
        ctx,
        generationsUp,
        generationsDown,
        displayOptions,
      })
    : { paternal: [], maternal: [], warnings: ["Chưa chọn được vợ/chồng để so sui gia."] };

  warnings.push(...rootLineage.warnings.map((warning) => `Bên người gốc: ${warning}`));
  warnings.push(...spouseLineage.warnings.map((warning) => `Bên vợ/chồng: ${warning}`));

  const coupleItems: InLawPersonItem[] = [
    {
      person: root,
      generation: 0,
      side: "center",
      branch: "couple",
      relationLabel: "Người gốc",
      addressHint: "Người đang chọn",
    },
  ];

  if (selectedSpouse) {
    coupleItems.push({
      person: selectedSpouse,
      generation: 0,
      side: "center",
      branch: "couple",
      relationLabel: root.gender === "female" ? "Chồng" : "Vợ/chồng",
      addressHint: "Người được so bên sui gia",
    });

    coupleItems.push(
      ...collectCommonDescendants({
        rootId: input.rootPersonId,
        spouseId: selectedSpouse.id,
        parentChildEdges: ctx.parentChildEdges,
        families: input.families ?? [],
        familyParents: input.familyParents ?? [],
        familyChildren: input.familyChildren ?? [],
        personsMap: ctx.personsMap,
        maxDepth: generationsDown,
      }),
    );
  }

  if (displayOptions.includeClan) {
    for (const item of collectSpousesForInLawItems(coupleItems, ctx, displayOptions)) {
      coupleItems.push(item);
    }
  }

  const rootPaternal = applyInLawAddressHints(
    applyRootKinshipLabelsForInLaw({ root, persons: input.persons, relationships: input.relationships, items: rootLineage.paternal }),
    root,
    selectedSpouse,
  );
  const rootMaternal = applyInLawAddressHints(
    applyRootKinshipLabelsForInLaw({ root, persons: input.persons, relationships: input.relationships, items: rootLineage.maternal }),
    root,
    selectedSpouse,
  );
  const couple = applyInLawAddressHints(
    applyRootKinshipLabelsForInLaw({ root, persons: input.persons, relationships: input.relationships, items: coupleItems }),
    root,
    selectedSpouse,
  );
  const spousePaternal = applyInLawAddressHints(
    applyRootKinshipLabelsForInLaw({ root, persons: input.persons, relationships: input.relationships, items: spouseLineage.paternal }),
    root,
    selectedSpouse,
  );
  const spouseMaternal = applyInLawAddressHints(
    applyRootKinshipLabelsForInLaw({ root, persons: input.persons, relationships: input.relationships, items: spouseLineage.maternal }),
    root,
    selectedSpouse,
  );

  return {
    root,
    spouses,
    selectedSpouse,
    rows: createInLawRows(
      generationsUp,
      generationsDown,
      rootPaternal,
      rootMaternal,
      couple,
      spousePaternal,
      spouseMaternal,
    ),
    warnings,
  };
}

function collectDirectBranchAncestors(input: {
  branchRootId: string;
  branch: LineageBranch;
  owner: "root" | "spouse";
  ctx: GraphContext;
  generationsUp: number;
}): LineagePersonItem[] {
  return collectAncestors(input.branchRootId, input.ctx.parentChildEdges, input.generationsUp)
    .map((node): LineagePersonItem | null => {
      const person = input.ctx.personsMap.get(node.personId);
      if (!person) return null;
      return {
        person,
        generation: -node.generation,
        branch: input.branch,
        relationLabel: branchAncestorLabel({
          branch: input.branch,
          generation: -node.generation,
          person,
          owner: input.owner,
        }),
      };
    })
    .filter((item): item is LineagePersonItem => Boolean(item));
}

function collectTwoBranchLineage(input: {
  ownerId: string;
  rootPersonId: string;
  owner: "root" | "spouse";
  ctx: GraphContext;
  generationsUp: number;
  generationsDown: number;
  displayOptions: LineageDisplayOptions;
}): { paternal: InLawPersonItem[]; maternal: InLawPersonItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const { fatherId, motherId } = getDirectParents(input.ownerId, input.ctx.parentChildEdges, input.ctx.personsMap);

  if (!fatherId) warnings.push("Chưa có cha trong dữ liệu.");
  if (!motherId) warnings.push("Chưa có mẹ trong dữ liệu.");

  const toInLawItems = (items: LineagePersonItem[], branch: LineageBranch): InLawPersonItem[] => {
    return items.map((item) => {
      const out = {
        person: item.person,
        generation: item.generation,
        side: input.owner,
        branch,
        relationLabel: item.relationLabel,
        addressHint: "",
        note: item.note,
        isInLaw: item.isInLaw,
      } satisfies InLawPersonItem;

      return {
        ...out,
        addressHint: addressHint(out),
      };
    });
  };

  const paternal = fatherId
    ? input.displayOptions.includeClan
      ? collectBranchClanLineage({
          branchRootId: fatherId,
          rootPersonId: input.ownerId,
          branch: "paternal",
          owner: input.owner,
          ctx: input.ctx,
          generationsUp: input.generationsUp,
          generationsDown: input.generationsDown,
          displayOptions: input.displayOptions,
        })
      : collectDirectBranchAncestors({
          branchRootId: fatherId,
          branch: "paternal",
          owner: input.owner,
          ctx: input.ctx,
          generationsUp: input.generationsUp,
        })
    : [];

  const maternal = motherId
    ? input.displayOptions.includeClan
      ? collectBranchClanLineage({
          branchRootId: motherId,
          rootPersonId: input.ownerId,
          branch: "maternal",
          owner: input.owner,
          ctx: input.ctx,
          generationsUp: input.generationsUp,
          generationsDown: input.generationsDown,
          displayOptions: input.displayOptions,
        })
      : collectDirectBranchAncestors({
          branchRootId: motherId,
          branch: "maternal",
          owner: input.owner,
          ctx: input.ctx,
          generationsUp: input.generationsUp,
        })
    : [];

  return {
    paternal: toInLawItems(paternal, "paternal"),
    maternal: toInLawItems(maternal, "maternal"),
    warnings,
  };
}

function collectBranchClanLineage(input: {
  branchRootId: string;
  rootPersonId: string;
  branch: LineageBranch;
  owner: "root" | "spouse";
  ctx: GraphContext;
  generationsUp: number;
  generationsDown: number;
  displayOptions: LineageDisplayOptions;
}): LineagePersonItem[] {
  const out = new Map<string, LineagePersonItem>();
  const directAncestorPath = collectAncestors(input.branchRootId, input.ctx.parentChildEdges, input.generationsUp);

  for (const ancestorNode of directAncestorPath) {
    const ancestorGeneration = -ancestorNode.generation;
    const descendants = collectDescendantsIncludingSelf(
      ancestorNode.personId,
      input.ctx.parentChildEdges,
      input.generationsDown + Math.abs(ancestorGeneration),
    );

    for (const descendant of descendants) {
      const generation = ancestorGeneration + descendant.generation;
      if (generation < -input.generationsUp || generation > input.generationsDown) continue;
      if (descendant.personId === input.rootPersonId) continue;

      const person = input.ctx.personsMap.get(descendant.personId);
      if (!person) continue;

      const isPathAncestor = descendant.personId === ancestorNode.personId;
      const relationLabel = isPathAncestor
        ? branchAncestorLabel({
            branch: input.branch,
            generation,
            person,
            owner: input.owner,
          })
        : sameGenerationLabel(generation);

      upsertLineageItem(out, {
        person,
        generation,
        branch: input.branch,
        relationLabel,
        note: isPathAncestor ? undefined : "Dòng họ cùng hàng",
      });
    }
  }

  const spouseItems = collectSpousesForItems(Array.from(out.values()), input.ctx, input.displayOptions, input.branch);
  for (const item of spouseItems) upsertLineageItem(out, item);

  return sortPersons(Array.from(out.values()));
}

function collectSpousesForItems(
  items: LineagePersonItem[],
  ctx: GraphContext,
  options: LineageDisplayOptions,
  branch: LineageBranch | "center",
): LineagePersonItem[] {
  if (!options.includeClan) return [];

  const out: LineagePersonItem[] = [];
  const itemIds = new Set(items.map((item) => item.person.id));

  for (const item of items) {
    const spouseIds = ctx.spousesByPerson.get(item.person.id) ?? [];
    for (const spouseId of spouseIds) {
      if (itemIds.has(spouseId)) continue;
      const spouse = ctx.personsMap.get(spouseId);
      if (!spouse) continue;
      if (!shouldShowInLaw(spouse, options)) continue;

      out.push({
        person: spouse,
        generation: item.generation,
        branch,
        relationLabel: spouseLabel(spouse, item.person),
        note: "Theo hôn nhân",
        isInLaw: true,
      });
    }
  }

  return out;
}

function collectSpousesForInLawItems(
  items: InLawPersonItem[],
  ctx: GraphContext,
  options: LineageDisplayOptions,
): InLawPersonItem[] {
  if (!options.includeClan) return [];

  const out: InLawPersonItem[] = [];
  const itemIds = new Set(items.map((item) => item.person.id));

  for (const item of items) {
    const spouseIds = ctx.spousesByPerson.get(item.person.id) ?? [];
    for (const spouseId of spouseIds) {
      if (itemIds.has(spouseId)) continue;
      const spouse = ctx.personsMap.get(spouseId);
      if (!spouse) continue;
      if (!shouldShowInLaw(spouse, options)) continue;

      const next = {
        person: spouse,
        generation: item.generation,
        side: item.side,
        branch: item.branch,
        relationLabel: spouseLabel(spouse, item.person),
        addressHint: "",
        note: "Theo hôn nhân",
        isInLaw: true,
      } satisfies InLawPersonItem;

      out.push({ ...next, addressHint: addressHint(next) });
    }
  }

  return out;
}

function upsertLineageItem(map: Map<string, LineagePersonItem>, item: LineagePersonItem) {
  const existing = map.get(item.person.id);
  if (!existing) {
    map.set(item.person.id, item);
    return;
  }

  // Giữ quan hệ tổ tiên trực hệ nếu đã có; chỉ thay nếu item mới gần gốc hơn.
  if (Math.abs(item.generation) < Math.abs(existing.generation)) {
    map.set(item.person.id, item);
  }
}

function createLineageRows(
  generationsUp: number,
  generationsDown: number,
  paternal: LineagePersonItem[],
  center: LineagePersonItem[],
  maternal: LineagePersonItem[],
): LineageGenerationRow[] {
  const rows: LineageGenerationRow[] = [];

  for (let generation = -generationsUp; generation <= generationsDown; generation += 1) {
    rows.push({
      generation,
      label: generationLabel(generation),
      paternal: sortPersons(paternal.filter((item) => item.generation === generation)),
      center: sortPersons(center.filter((item) => item.generation === generation)),
      maternal: sortPersons(maternal.filter((item) => item.generation === generation)),
    });
  }

  return rows;
}

function createInLawRows(
  generationsUp: number,
  generationsDown: number,
  rootPaternal: InLawPersonItem[],
  rootMaternal: InLawPersonItem[],
  couple: InLawPersonItem[],
  spousePaternal: InLawPersonItem[],
  spouseMaternal: InLawPersonItem[],
): InLawGenerationRow[] {
  const rows: InLawGenerationRow[] = [];

  for (let generation = -generationsUp; generation <= generationsDown; generation += 1) {
    rows.push({
      generation,
      label: generationLabel(generation),
      rootPaternal: sortPersons(rootPaternal.filter((item) => item.generation === generation)),
      rootMaternal: sortPersons(rootMaternal.filter((item) => item.generation === generation)),
      couple: sortPersons(couple.filter((item) => item.generation === generation)),
      spousePaternal: sortPersons(spousePaternal.filter((item) => item.generation === generation)),
      spouseMaternal: sortPersons(spouseMaternal.filter((item) => item.generation === generation)),
    });
  }

  return rows;
}

function collectCommonDescendants(input: {
  rootId: string;
  spouseId: string;
  parentChildEdges: ParentChildEdge[];
  families: FamilyRow[];
  familyParents: FamilyParentRow[];
  familyChildren: FamilyChildRow[];
  personsMap: Map<string, Person>;
  maxDepth: number;
}): InLawPersonItem[] {
  const directCommonChildren = new Set<string>();

  for (const family of input.families) {
    if (family.deleted_at) continue;

    const parents = input.familyParents
      .filter((parent) => parent.family_id === family.id)
      .map((parent) => parent.person_id);

    if (!parents.includes(input.rootId) || !parents.includes(input.spouseId)) continue;

    for (const child of input.familyChildren.filter((row) => row.family_id === family.id)) {
      directCommonChildren.add(child.person_id);
    }
  }

  if (directCommonChildren.size === 0) {
    const rootChildren = new Set(
      input.parentChildEdges
        .filter((edge) => edge.parentId === input.rootId)
        .map((edge) => edge.childId),
    );
    const spouseChildren = new Set(
      input.parentChildEdges
        .filter((edge) => edge.parentId === input.spouseId)
        .map((edge) => edge.childId),
    );

    for (const childId of rootChildren) {
      if (spouseChildren.has(childId)) directCommonChildren.add(childId);
    }
  }

  const out = new Map<string, InLawPersonItem>();
  const queue = Array.from(directCommonChildren).map((personId) => ({ personId, generation: 1 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (visited.has(current.personId)) continue;
    if (current.generation > input.maxDepth) continue;

    visited.add(current.personId);
    const person = input.personsMap.get(current.personId);

    if (person) {
      const relationLabel = descendantLabel(current.generation);
      const item = {
        person,
        generation: current.generation,
        side: "center",
        branch: "descendant",
        relationLabel,
        addressHint: "",
      } satisfies InLawPersonItem;

      out.set(current.personId, {
        ...item,
        addressHint: addressHint(item),
      });
    }

    if (current.generation >= input.maxDepth) continue;

    const childIds = input.parentChildEdges
      .filter((edge) => edge.parentId === current.personId)
      .map((edge) => edge.childId);

    for (const childId of childIds) {
      queue.push({ personId: childId, generation: current.generation + 1 });
    }
  }

  return sortPersons(Array.from(out.values()));
}

function collectAncestors(
  startPersonId: string,
  parentChildEdges: ParentChildEdge[],
  maxDepth: number,
): CollectedPerson[] {
  const out: CollectedPerson[] = [];
  const queue: CollectedPerson[] = [{ personId: startPersonId, generation: 1 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (visited.has(current.personId)) continue;
    if (current.generation > maxDepth) continue;

    visited.add(current.personId);
    out.push(current);

    const parentIds = parentChildEdges
      .filter((edge) => edge.childId === current.personId)
      .map((edge) => edge.parentId);

    for (const parentId of parentIds) {
      queue.push({ personId: parentId, generation: current.generation + 1 });
    }
  }

  return out;
}

function collectDescendants(
  startPersonId: string,
  parentChildEdges: ParentChildEdge[],
  maxDepth: number,
): CollectedPerson[] {
  return collectDescendantsIncludingSelf(startPersonId, parentChildEdges, maxDepth).filter(
    (node) => node.generation > 0,
  );
}

function collectDescendantsIncludingSelf(
  startPersonId: string,
  parentChildEdges: ParentChildEdge[],
  maxDepth: number,
): CollectedPerson[] {
  const out: CollectedPerson[] = [];
  const queue: CollectedPerson[] = [{ personId: startPersonId, generation: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (visited.has(current.personId)) continue;
    if (current.generation > maxDepth) continue;

    visited.add(current.personId);
    out.push(current);

    if (current.generation >= maxDepth) continue;

    const childIds = parentChildEdges
      .filter((edge) => edge.parentId === current.personId)
      .map((edge) => edge.childId);

    for (const childId of childIds) {
      queue.push({ personId: childId, generation: current.generation + 1 });
    }
  }

  return out;
}

function getDirectParents(
  personId: string,
  parentChildEdges: ParentChildEdge[],
  personsMap: Map<string, Person>,
): { fatherId: string | null; motherId: string | null } {
  const parentIds = parentChildEdges
    .filter((edge) => edge.childId === personId)
    .map((edge) => edge.parentId)
    .filter((id) => personsMap.has(id));

  const fatherId =
    parentIds.find((id) => personsMap.get(id)?.gender === "male") ?? parentIds[0] ?? null;
  const motherId =
    parentIds.find((id) => personsMap.get(id)?.gender === "female") ??
    parentIds.find((id) => id !== fatherId) ??
    null;

  return { fatherId, motherId };
}

function getSpouses(
  personId: string,
  spouseEdges: SpouseEdge[],
  personsMap: Map<string, Person>,
): Person[] {
  const spouseIds = new Set<string>();

  for (const edge of spouseEdges) {
    if (edge.personA === personId) spouseIds.add(edge.personB);
    if (edge.personB === personId) spouseIds.add(edge.personA);
  }

  return Array.from(spouseIds)
    .map((id) => personsMap.get(id))
    .filter((person): person is Person => Boolean(person))
    .sort((a, b) => getPersonName(a).localeCompare(getPersonName(b), "vi"));
}

function buildParentChildEdges(input: {
  relationships?: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
}): ParentChildEdge[] {
  const out: ParentChildEdge[] = [];
  const activeFamilyIds = new Set(
    (input.families ?? [])
      .filter((family) => !family.deleted_at)
      .map((family) => family.id),
  );

  const parentsByFamily = new Map<string, string[]>();

  for (const parent of input.familyParents ?? []) {
    if (activeFamilyIds.size > 0 && !activeFamilyIds.has(parent.family_id)) continue;
    const arr = parentsByFamily.get(parent.family_id) ?? [];
    arr.push(parent.person_id);
    parentsByFamily.set(parent.family_id, arr);
  }

  for (const child of input.familyChildren ?? []) {
    if (activeFamilyIds.size > 0 && !activeFamilyIds.has(child.family_id)) continue;
    const parents = parentsByFamily.get(child.family_id) ?? [];
    for (const parentId of parents) {
      out.push({ parentId, childId: child.person_id });
    }
  }

  for (const rel of input.relationships ?? []) {
    if (rel.type !== "biological_child" && rel.type !== "adopted_child") continue;
    out.push({ parentId: rel.person_a, childId: rel.person_b });
  }

  return dedupeParentChildEdges(out);
}

function buildSpouseEdges(input: {
  relationships?: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
}): SpouseEdge[] {
  const out: SpouseEdge[] = [];
  const activeCurrentFamilyIds = new Set(
    (input.families ?? [])
      .filter((family) => !family.deleted_at)
      .filter((family) => family.status !== "divorced" && family.status !== "separated")
      .map((family) => family.id),
  );

  const parentsByFamily = new Map<string, string[]>();

  for (const parent of input.familyParents ?? []) {
    if (activeCurrentFamilyIds.size > 0 && !activeCurrentFamilyIds.has(parent.family_id)) continue;
    const arr = parentsByFamily.get(parent.family_id) ?? [];
    arr.push(parent.person_id);
    parentsByFamily.set(parent.family_id, arr);
  }

  for (const parentIds of parentsByFamily.values()) {
    for (let i = 0; i < parentIds.length; i += 1) {
      for (let j = i + 1; j < parentIds.length; j += 1) {
        out.push({ personA: parentIds[i], personB: parentIds[j] });
      }
    }
  }

  for (const rel of input.relationships ?? []) {
    if (rel.type !== "marriage") continue;
    if (rel.status === "divorced" || rel.status === "separated") continue;
    out.push({ personA: rel.person_a, personB: rel.person_b });
  }

  return dedupeSpouseEdges(out);
}

function dedupeParentChildEdges(edges: ParentChildEdge[]): ParentChildEdge[] {
  const seen = new Set<string>();
  const out: ParentChildEdge[] = [];

  for (const edge of edges) {
    const key = `${edge.parentId}->${edge.childId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }

  return out;
}

function dedupeSpouseEdges(edges: SpouseEdge[]): SpouseEdge[] {
  const seen = new Set<string>();
  const out: SpouseEdge[] = [];

  for (const edge of edges) {
    const key = [edge.personA, edge.personB].sort().join("<->");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }

  return out;
}
