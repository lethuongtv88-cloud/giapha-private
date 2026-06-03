import type { Person, Relationship } from "@/types";
import type {
  FamilyChildRow,
  FamilyParentRow,
  FamilyRow,
} from "@/services/statistics/globalStats.service";

export type RootRelationClass =
  | "root"
  | "bloodline"
  | "paternal_branch"
  | "maternal_branch"
  | "both_branches"
  | "spouse_in_law"
  | "unknown";

export interface RootStatsInput {
  rootPersonId: string;
  persons: Person[];
  relationships?: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
}

export interface RootStatsResult {
  rootPersonId: string;

  totalVisiblePeople: number;

  relation: {
    bloodline: number;
    inLaws: number;
    paternalBranch: number;
    maternalBranch: number;
    bothBranches: number;
    unknown: number;
  };

  gender: {
    male: number;
    female: number;
    other: number;
    unknown: number;
  };

  maritalStatus: {
    married: number;
    unmarried: number;
    unknown: number;
  };

  classifiedPeople: Array<{
    personId: string;
    className: RootRelationClass;
  }>;
}

interface ParentChildEdge {
  parentId: string;
  childId: string;
}

interface SpouseEdge {
  personA: string;
  personB: string;
}

export function calculateRootStats(input: RootStatsInput): RootStatsResult {
  const persons = input.persons ?? [];
  const personsMap = new Map(persons.map((person) => [person.id, person]));

  const parentChildEdges = buildParentChildEdges(input);
  const spouseEdges = buildSpouseEdges(input);

  const classification = classifyByRoot({
    rootPersonId: input.rootPersonId,
    personsMap,
    parentChildEdges,
    spouseEdges,
  });

  const marriedIds = getCurrentlyMarriedIds({
    personsMap,
    relationships: input.relationships ?? [],
    families: input.families ?? [],
    familyParents: input.familyParents ?? [],
    spouseEdges,
  });

  const relation = {
    bloodline: 0,
    inLaws: 0,
    paternalBranch: 0,
    maternalBranch: 0,
    bothBranches: 0,
    unknown: 0,
  };

  const gender = {
    male: 0,
    female: 0,
    other: 0,
    unknown: 0,
  };

  const maritalStatus = {
    married: 0,
    unmarried: 0,
    unknown: 0,
  };

  const classifiedPeople: RootStatsResult["classifiedPeople"] = [];

  for (const person of persons) {
    const className = classification.get(person.id) ?? "unknown";
    classifiedPeople.push({ personId: person.id, className });

    if (className === "root" || className === "bloodline") {
      relation.bloodline += 1;
    } else if (className === "spouse_in_law") {
      relation.inLaws += 1;
    } else if (className === "paternal_branch") {
      relation.paternalBranch += 1;
      relation.bloodline += 1;
    } else if (className === "maternal_branch") {
      relation.maternalBranch += 1;
      relation.bloodline += 1;
    } else if (className === "both_branches") {
      relation.bothBranches += 1;
      relation.bloodline += 1;
    } else {
      relation.unknown += 1;
    }

    if (person.gender === "male") {
      gender.male += 1;
    } else if (person.gender === "female") {
      gender.female += 1;
    } else if (person.gender === "other") {
      gender.other += 1;
    } else {
      gender.unknown += 1;
    }

    if (marriedIds.has(person.id)) {
      maritalStatus.married += 1;
    } else {
      maritalStatus.unmarried += 1;
    }
  }

  return {
    rootPersonId: input.rootPersonId,
    totalVisiblePeople: persons.length,
    relation,
    gender,
    maritalStatus,
    classifiedPeople,
  };
}

function classifyByRoot(input: {
  rootPersonId: string;
  personsMap: Map<string, Person>;
  parentChildEdges: ParentChildEdge[];
  spouseEdges: SpouseEdge[];
}): Map<string, RootRelationClass> {
  const result = new Map<string, RootRelationClass>();

  if (!input.personsMap.has(input.rootPersonId)) {
    return result;
  }

  const bloodline = collectConnectedByParentChild(
    input.rootPersonId,
    input.parentChildEdges,
  );

  const rootParents = input.parentChildEdges
    .filter((edge) => edge.childId === input.rootPersonId)
    .map((edge) => edge.parentId);

  const fatherId =
    rootParents.find((id) => input.personsMap.get(id)?.gender === "male") ??
    rootParents[0] ??
    null;

  const motherId =
    rootParents.find((id) => input.personsMap.get(id)?.gender === "female") ??
    rootParents.find((id) => id !== fatherId) ??
    null;

  const paternal = fatherId
    ? collectConnectedByParentChild(fatherId, input.parentChildEdges)
    : new Set<string>();

  const maternal = motherId
    ? collectConnectedByParentChild(motherId, input.parentChildEdges)
    : new Set<string>();

  for (const personId of bloodline) {
    if (personId === input.rootPersonId) {
      result.set(personId, "root");
      continue;
    }

    const inPaternal = paternal.has(personId);
    const inMaternal = maternal.has(personId);

    if (inPaternal && inMaternal) {
      result.set(personId, "both_branches");
    } else if (inPaternal) {
      result.set(personId, "paternal_branch");
    } else if (inMaternal) {
      result.set(personId, "maternal_branch");
    } else {
      result.set(personId, "bloodline");
    }
  }

  for (const spouse of input.spouseEdges) {
    const aIsBloodline = bloodline.has(spouse.personA);
    const bIsBloodline = bloodline.has(spouse.personB);

    if (aIsBloodline && !bIsBloodline && input.personsMap.has(spouse.personB)) {
      result.set(spouse.personB, "spouse_in_law");
    }

    if (bIsBloodline && !aIsBloodline && input.personsMap.has(spouse.personA)) {
      result.set(spouse.personA, "spouse_in_law");
    }
  }

  return result;
}

function buildParentChildEdges(input: RootStatsInput): ParentChildEdge[] {
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
      out.push({
        parentId,
        childId: child.person_id,
      });
    }
  }

  // Fallback legacy.
  for (const rel of input.relationships ?? []) {
    if (rel.type !== "biological_child" && rel.type !== "adopted_child") continue;

    out.push({
      parentId: rel.person_a,
      childId: rel.person_b,
    });
  }

  return dedupeParentChildEdges(out);
}

function buildSpouseEdges(input: RootStatsInput): SpouseEdge[] {
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
        out.push({
          personA: parentIds[i],
          personB: parentIds[j],
        });
      }
    }
  }

  // Fallback legacy.
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

function collectConnectedByParentChild(
  startPersonId: string,
  edges: ParentChildEdge[],
): Set<string> {
  const out = new Set<string>();
  const queue = [startPersonId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (out.has(current)) continue;

    out.add(current);

    for (const edge of edges) {
      if (edge.parentId === current && !out.has(edge.childId)) {
        queue.push(edge.childId);
      }

      if (edge.childId === current && !out.has(edge.parentId)) {
        queue.push(edge.parentId);
      }
    }
  }

  return out;
}

function getCurrentlyMarriedIds(input: {
  personsMap: Map<string, Person>;
  relationships: Relationship[];
  families: FamilyRow[];
  familyParents: FamilyParentRow[];
  spouseEdges: SpouseEdge[];
}): Set<string> {
  const out = new Set<string>();

  for (const edge of input.spouseEdges) {
    if (input.personsMap.has(edge.personA)) out.add(edge.personA);
    if (input.personsMap.has(edge.personB)) out.add(edge.personB);
  }

  return out;
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
