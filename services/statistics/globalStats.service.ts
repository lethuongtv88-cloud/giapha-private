import type { Person, Relationship } from "@/types";

export type FamilyStatus = "active" | "divorced" | "separated" | string | null;

export interface FamilyRow {
  id: string;
  status?: FamilyStatus;
  deleted_at?: string | null;
}

export interface FamilyParentRow {
  id?: string;
  family_id: string;
  person_id: string;
  role?: string | null;
  sort_order?: number | null;
}

export interface FamilyChildRow {
  id?: string;
  family_id: string;
  person_id: string;
  relationship_type?: string | null;
  sort_order?: number | null;
}

export interface EventRow {
  id: string;
  type?: string | null;
  deleted_at?: string | null;
}

export interface GlobalStatsInput {
  persons: Person[];
  relationships?: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
  events?: EventRow[];
}

export interface GlobalStatsResult {
  totalPersons: number;

  gender: {
    male: number;
    female: number;
    other: number;
    unknown: number;
  };

  lifeStatus: {
    living: number;
    deceased: number;
    unknown: number;
  };

  maritalStatus: {
    married: number;
    unmarried: number;
    unknown: number;
  };

  childStatus: {
    hasChildren: number;
    noChildren: number;
    unknown: number;
  };

  totals: {
    families: number;
    events: number;
  };
}

export function calculateGlobalStats(input: GlobalStatsInput): GlobalStatsResult {
  const persons = input.persons ?? [];
  const relationships = input.relationships ?? [];
  const families = input.families ?? [];
  const familyParents = input.familyParents ?? [];
  const familyChildren = input.familyChildren ?? [];
  const events = input.events ?? [];

  const activePersonIds = new Set(persons.map((person) => person.id));

  const activeFamilies = families.filter((family) => !family.deleted_at);
  const activeFamilyIds = new Set(activeFamilies.map((family) => family.id));

  const activeCurrentFamilyIds = new Set(
    activeFamilies
      .filter((family) => !isEndedFamilyStatus(family.status))
      .map((family) => family.id),
  );

  const activeEvents = events.filter((event) => !event.deleted_at);

  const gender = {
    male: 0,
    female: 0,
    other: 0,
    unknown: 0,
  };

  const lifeStatus = {
    living: 0,
    deceased: 0,
    unknown: 0,
  };

  for (const person of persons) {
    if (person.gender === "male") {
      gender.male += 1;
    } else if (person.gender === "female") {
      gender.female += 1;
    } else if (person.gender === "other") {
      gender.other += 1;
    } else {
      gender.unknown += 1;
    }

    if (person.is_deceased === true) {
      lifeStatus.deceased += 1;
    } else if (person.is_deceased === false) {
      lifeStatus.living += 1;
    } else {
      lifeStatus.unknown += 1;
    }
  }

  const marriedIds = getMarriedPersonIds({
    activePersonIds,
    relationships,
    familyParents,
    activeCurrentFamilyIds,
  });

  const parentWithChildrenIds = getParentWithChildrenIds({
    activePersonIds,
    relationships,
    familyParents,
    familyChildren,
    activeFamilyIds,
  });

  const maritalStatus = {
    married: 0,
    unmarried: 0,
    unknown: 0,
  };

  const childStatus = {
    hasChildren: 0,
    noChildren: 0,
    unknown: 0,
  };

  for (const person of persons) {
    if (marriedIds.has(person.id)) {
      maritalStatus.married += 1;
    } else {
      maritalStatus.unmarried += 1;
    }

    if (parentWithChildrenIds.has(person.id)) {
      childStatus.hasChildren += 1;
    } else {
      childStatus.noChildren += 1;
    }
  }

  return {
    totalPersons: persons.length,
    gender,
    lifeStatus,
    maritalStatus,
    childStatus,
    totals: {
      families: activeFamilies.length,
      events: activeEvents.length,
    },
  };
}

function getMarriedPersonIds(input: {
  activePersonIds: Set<string>;
  relationships: Relationship[];
  familyParents: FamilyParentRow[];
  activeCurrentFamilyIds: Set<string>;
}): Set<string> {
  const out = new Set<string>();

  // Ưu tiên Family Model.
  for (const parent of input.familyParents) {
    if (
      input.activeCurrentFamilyIds.has(parent.family_id) &&
      input.activePersonIds.has(parent.person_id)
    ) {
      out.add(parent.person_id);
    }
  }

  // Fallback legacy relationships nếu Family Model chưa được truyền vào page.
  for (const rel of input.relationships) {
    if (rel.type !== "marriage") continue;
    if (isEndedFamilyStatus(rel.status)) continue;

    if (input.activePersonIds.has(rel.person_a)) out.add(rel.person_a);
    if (input.activePersonIds.has(rel.person_b)) out.add(rel.person_b);
  }

  return out;
}

function getParentWithChildrenIds(input: {
  activePersonIds: Set<string>;
  relationships: Relationship[];
  familyParents: FamilyParentRow[];
  familyChildren: FamilyChildRow[];
  activeFamilyIds: Set<string>;
}): Set<string> {
  const out = new Set<string>();

  const familiesWithChildren = new Set<string>();

  for (const child of input.familyChildren) {
    if (
      input.activeFamilyIds.has(child.family_id) &&
      input.activePersonIds.has(child.person_id)
    ) {
      familiesWithChildren.add(child.family_id);
    }
  }

  for (const parent of input.familyParents) {
    if (
      familiesWithChildren.has(parent.family_id) &&
      input.activePersonIds.has(parent.person_id)
    ) {
      out.add(parent.person_id);
    }
  }

  // Fallback legacy relationships.
  for (const rel of input.relationships) {
    if (rel.type !== "biological_child" && rel.type !== "adopted_child") continue;

    if (input.activePersonIds.has(rel.person_a) && input.activePersonIds.has(rel.person_b)) {
      out.add(rel.person_a);
    }
  }

  return out;
}

function isEndedFamilyStatus(status: FamilyStatus): boolean {
  return status === "divorced" || status === "separated";
}
