import type { Person, Relationship } from "@/types";
import type {
  FamilyChildRow,
  FamilyParentRow,
  FamilyRow,
} from "@/services/statistics/globalStats.service";

export type DualSide = "root" | "paternal" | "maternal" | "descendant" | "spouse" | "shared";

export interface DualAncestryPersonNode {
  person: Person;
  side: DualSide;
  depth: number;
  note?: string;
}

export interface DualTreeSubgraph {
  title: string;
  nodes: DualAncestryPersonNode[];
}

export interface DualAncestryGraph {
  root: DualAncestryPersonNode | null;
  paternal: DualTreeSubgraph;
  maternal: DualTreeSubgraph;
  descendants: DualTreeSubgraph;
  spouses: DualTreeSubgraph;
  shared: DualTreeSubgraph;
  warnings: string[];
}

export interface BuildDualAncestryGraphInput {
  rootPersonId: string;
  generationsUp?: number;
  generationsDown?: number;
  includeSpouses?: boolean;
  includeInLaws?: boolean;
  persons: Person[];
  relationships?: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
}

interface ParentChildEdge {
  parentId: string;
  childId: string;
}

interface SpouseEdge {
  personA: string;
  personB: string;
}

interface CollectedNode {
  personId: string;
  depth: number;
}

export function buildDualAncestryGraph(
  input: BuildDualAncestryGraphInput,
): DualAncestryGraph {
  const generationsUp = input.generationsUp ?? 3;
  const generationsDown = input.generationsDown ?? 3;
  const includeSpouses = input.includeSpouses ?? true;
  const includeInLaws = input.includeInLaws ?? true;

  const personsMap = new Map(input.persons.map((person) => [person.id, person]));
  const rootPerson = personsMap.get(input.rootPersonId) ?? null;

  const warnings: string[] = [];

  if (!rootPerson) {
    return emptyGraph([`Không tìm thấy người gốc: ${input.rootPersonId}`]);
  }

  const parentChildEdges = buildParentChildEdges(input);
  const spouseEdges = buildSpouseEdges(input);

  const directParents = parentChildEdges
    .filter((edge) => edge.childId === input.rootPersonId)
    .map((edge) => edge.parentId)
    .filter((id) => personsMap.has(id));

  const fatherId =
    directParents.find((id) => personsMap.get(id)?.gender === "male") ??
    directParents[0] ??
    null;

  const motherId =
    directParents.find((id) => personsMap.get(id)?.gender === "female") ??
    directParents.find((id) => id !== fatherId) ??
    null;

  if (!fatherId) warnings.push("Người gốc chưa có cha trong dữ liệu.");
  if (!motherId) warnings.push("Người gốc chưa có mẹ trong dữ liệu.");

  const paternalRaw = fatherId
    ? collectAncestors({
        startPersonId: fatherId,
        parentChildEdges,
        maxDepth: generationsUp,
      })
    : [];

  const maternalRaw = motherId
    ? collectAncestors({
        startPersonId: motherId,
        parentChildEdges,
        maxDepth: generationsUp,
      })
    : [];

  const descendantRaw = collectDescendants({
    startPersonId: input.rootPersonId,
    parentChildEdges,
    maxDepth: generationsDown,
  });

  const paternalIds = new Set(paternalRaw.map((node) => node.personId));
  const maternalIds = new Set(maternalRaw.map((node) => node.personId));

  const sharedIds = new Set<string>();
  for (const personId of paternalIds) {
    if (maternalIds.has(personId)) sharedIds.add(personId);
  }

  if (sharedIds.size > 0) {
    warnings.push(
      "Có người xuất hiện ở cả nhánh cha và nhánh mẹ. Có thể do kết hôn nội tộc, nhập trùng, hoặc dữ liệu vòng.",
    );
  }

  const paternalNodes = toNodes({
    raw: paternalRaw.filter((node) => !sharedIds.has(node.personId)),
    personsMap,
    side: "paternal",
  });

  const maternalNodes = toNodes({
    raw: maternalRaw.filter((node) => !sharedIds.has(node.personId)),
    personsMap,
    side: "maternal",
  });

  const descendantNodes = toNodes({
    raw: descendantRaw,
    personsMap,
    side: "descendant",
  });

  const sharedNodes = toNodes({
    raw: Array.from(sharedIds).map((personId) => ({ personId, depth: 0 })),
    personsMap,
    side: "shared",
  });

  const spouseNodes =
    includeSpouses || includeInLaws
      ? collectSpouses({
          rootPersonId: input.rootPersonId,
          paternalNodes,
          maternalNodes,
          descendantNodes,
          sharedNodes,
          spouseEdges,
          personsMap,
          includeRootSpouses: includeSpouses,
          includeInLaws,
        })
      : [];

  return {
    root: {
      person: rootPerson,
      side: "root",
      depth: 0,
    },
    paternal: {
      title: "Nhánh cha / Họ nội",
      nodes: sortNodes(paternalNodes),
    },
    maternal: {
      title: "Nhánh mẹ / Họ ngoại",
      nodes: sortNodes(maternalNodes),
    },
    descendants: {
      title: "Con cháu",
      nodes: sortNodes(descendantNodes),
    },
    spouses: {
      title: "Vợ/chồng / Dâu rễ liên quan",
      nodes: sortNodes(spouseNodes),
    },
    shared: {
      title: "Xuất hiện ở cả hai nhánh",
      nodes: sortNodes(sharedNodes),
    },
    warnings,
  };
}

function emptyGraph(warnings: string[]): DualAncestryGraph {
  return {
    root: null,
    paternal: { title: "Nhánh cha / Họ nội", nodes: [] },
    maternal: { title: "Nhánh mẹ / Họ ngoại", nodes: [] },
    descendants: { title: "Con cháu", nodes: [] },
    spouses: { title: "Vợ/chồng / Dâu rễ liên quan", nodes: [] },
    shared: { title: "Xuất hiện ở cả hai nhánh", nodes: [] },
    warnings,
  };
}

function buildParentChildEdges(input: BuildDualAncestryGraphInput): ParentChildEdge[] {
  const out: ParentChildEdge[] = [];

  const activeFamilyIds = new Set(
    (input.families ?? [])
      .filter((family) => !family.deleted_at)
      .map((family) => family.id),
  );

  const parentsByFamily = new Map<string, string[]>();

  for (const parent of input.familyParents ?? []) {
    if (activeFamilyIds.size > 0 && !activeFamilyIds.has(parent.family_id)) {
      continue;
    }

    const arr = parentsByFamily.get(parent.family_id) ?? [];
    arr.push(parent.person_id);
    parentsByFamily.set(parent.family_id, arr);
  }

  for (const child of input.familyChildren ?? []) {
    if (activeFamilyIds.size > 0 && !activeFamilyIds.has(child.family_id)) {
      continue;
    }

    const parents = parentsByFamily.get(child.family_id) ?? [];
    for (const parentId of parents) {
      out.push({
        parentId,
        childId: child.person_id,
      });
    }
  }

  for (const rel of input.relationships ?? []) {
    if (rel.type !== "biological_child" && rel.type !== "adopted_child") {
      continue;
    }

    out.push({
      parentId: rel.person_a,
      childId: rel.person_b,
    });
  }

  return dedupeParentChildEdges(out);
}

function buildSpouseEdges(input: BuildDualAncestryGraphInput): SpouseEdge[] {
  const out: SpouseEdge[] = [];

  const activeCurrentFamilyIds = new Set(
    (input.families ?? [])
      .filter((family) => !family.deleted_at)
      .filter(
        (family) =>
          family.status !== "divorced" && family.status !== "separated",
      )
      .map((family) => family.id),
  );

  const parentsByFamily = new Map<string, string[]>();

  for (const parent of input.familyParents ?? []) {
    if (
      activeCurrentFamilyIds.size > 0 &&
      !activeCurrentFamilyIds.has(parent.family_id)
    ) {
      continue;
    }

    const arr = parentsByFamily.get(parent.family_id) ?? [];
    arr.push(parent.person_id);
    parentsByFamily.set(parent.family_id, arr);
  }

  for (const parentIds of parentsByFamily.values()) {
    for (let i = 0; i < parentIds.length; i += 1) {
      for (let j = i + 1; j < parentIds.length; j += 1) {
        out.push({
          personA: parentIds[i],
          personB: parentIds[j],
        });
      }
    }
  }

  for (const rel of input.relationships ?? []) {
    if (rel.type !== "marriage") continue;
    if (rel.status === "divorced" || rel.status === "separated") continue;

    out.push({
      personA: rel.person_a,
      personB: rel.person_b,
    });
  }

  return dedupeSpouseEdges(out);
}

function collectAncestors(input: {
  startPersonId: string;
  parentChildEdges: ParentChildEdge[];
  maxDepth: number;
}): CollectedNode[] {
  const out: CollectedNode[] = [];
  const visited = new Set<string>();
  const queue: CollectedNode[] = [{ personId: input.startPersonId, depth: 1 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (visited.has(current.personId)) continue;
    if (current.depth > input.maxDepth) continue;

    visited.add(current.personId);
    out.push(current);

    const parentIds = input.parentChildEdges
      .filter((edge) => edge.childId === current.personId)
      .map((edge) => edge.parentId);

    for (const parentId of parentIds) {
      queue.push({
        personId: parentId,
        depth: current.depth + 1,
      });
    }
  }

  return out;
}

function collectDescendants(input: {
  startPersonId: string;
  parentChildEdges: ParentChildEdge[];
  maxDepth: number;
}): CollectedNode[] {
  const out: CollectedNode[] = [];
  const visited = new Set<string>();
  const queue: CollectedNode[] = [{ personId: input.startPersonId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (visited.has(current.personId)) continue;

    visited.add(current.personId);

    if (current.personId !== input.startPersonId && current.depth <= input.maxDepth) {
      out.push(current);
    }

    if (current.depth >= input.maxDepth) continue;

    const childIds = input.parentChildEdges
      .filter((edge) => edge.parentId === current.personId)
      .map((edge) => edge.childId);

    for (const childId of childIds) {
      queue.push({
        personId: childId,
        depth: current.depth + 1,
      });
    }
  }

  return out;
}

function collectSpouses(input: {
  rootPersonId: string;
  paternalNodes: DualAncestryPersonNode[];
  maternalNodes: DualAncestryPersonNode[];
  descendantNodes: DualAncestryPersonNode[];
  sharedNodes: DualAncestryPersonNode[];
  spouseEdges: SpouseEdge[];
  personsMap: Map<string, Person>;
  includeRootSpouses: boolean;
  includeInLaws: boolean;
}): DualAncestryPersonNode[] {
  const baseIds = new Set<string>();

  if (input.includeRootSpouses) {
    baseIds.add(input.rootPersonId);
  }

  if (input.includeInLaws) {
    for (const node of input.paternalNodes) baseIds.add(node.person.id);
    for (const node of input.maternalNodes) baseIds.add(node.person.id);
    for (const node of input.descendantNodes) baseIds.add(node.person.id);
    for (const node of input.sharedNodes) baseIds.add(node.person.id);
  }

  const out = new Map<string, DualAncestryPersonNode>();

  for (const edge of input.spouseEdges) {
    const spouseId = baseIds.has(edge.personA)
      ? edge.personB
      : baseIds.has(edge.personB)
        ? edge.personA
        : null;

    if (!spouseId) continue;
    if (baseIds.has(spouseId)) continue;

    const spouse = input.personsMap.get(spouseId);
    if (!spouse) continue;

    out.set(spouseId, {
      person: spouse,
      side: "spouse",
      depth: 0,
      note: "Vợ/chồng liên quan",
    });
  }

  return Array.from(out.values());
}

function toNodes(input: {
  raw: CollectedNode[];
  personsMap: Map<string, Person>;
  side: DualSide;
}): DualAncestryPersonNode[] {
  return input.raw
    .map((node) => {
      const person = input.personsMap.get(node.personId);
      if (!person) return null;

      return {
        person,
        side: input.side,
        depth: node.depth,
      };
    })
    .filter((node): node is DualAncestryPersonNode => Boolean(node));
}

function sortNodes(nodes: DualAncestryPersonNode[]): DualAncestryPersonNode[] {
  return [...nodes].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return getPersonName(a.person).localeCompare(getPersonName(b.person), "vi");
  });
}

function getPersonName(person: Person): string {
  return person.full_name || person.id;
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
    const pair = [edge.personA, edge.personB].sort().join("<->");
    if (seen.has(pair)) continue;

    seen.add(pair);
    out.push(edge);
  }

  return out;
}
