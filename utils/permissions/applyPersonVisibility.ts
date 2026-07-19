import { buildVisiblePersons } from "@/utils/permissions/visiblePersons";

export type PermissionProfile = {
  role?: string | null;
  person_id?: string | null;
  /** "Gốc chỉnh sửa" (rootedit) do admin gán riêng cho tài khoản này. */
  edit_root_person_id?: string | null;
};

export type PersonLike = {
  id: string;
  deleted_at?: string | null;
  [key: string]: unknown;
};

export type RelationshipLike = {
  id?: string;
  type?: string | null;
  person_a?: string | null;
  person_b?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
};

export type FamilyLike = {
  id: string;
  deleted_at?: string | null;
  [key: string]: unknown;
};

export type FamilyParentLike = {
  family_id: string;
  person_id: string;
  [key: string]: unknown;
};

export type FamilyChildLike = {
  family_id: string;
  person_id: string;
  [key: string]: unknown;
};

export type PermissionFilterResult<
  TPerson extends PersonLike,
  TRelationship extends RelationshipLike,
  TFamily extends FamilyLike,
  TFamilyParent extends FamilyParentLike,
  TFamilyChild extends FamilyChildLike,
> = {
  isAdmin: boolean;
  isRestricted: boolean;
  viewerPersonId: string | null;
  visiblePersonIds: Set<string>;
  editablePersonIds: Set<string>;
  warnings: string[];
  persons: TPerson[];
  relationships: TRelationship[];
  families: TFamily[];
  familyParents: TFamilyParent[];
  familyChildren: TFamilyChild[];
};

export function isAdminProfile(profile: PermissionProfile | null | undefined) {
  return profile?.role === "admin";
}

export function buildVisiblePersonSetForProfile(input: {
  profile: PermissionProfile | null | undefined;
  persons: PersonLike[];
  relationships?: RelationshipLike[];
  families?: FamilyLike[];
  familyParents?: FamilyParentLike[];
  familyChildren?: FamilyChildLike[];
}) {
  const isAdmin = isAdminProfile(input.profile);

  if (isAdmin) {
    const allPersonIds = new Set(input.persons.map((person) => person.id));
    return {
      isAdmin: true,
      isRestricted: false,
      viewerPersonId: input.profile?.person_id ?? null,
      visiblePersonIds: allPersonIds,
      editablePersonIds: new Set(allPersonIds),
      warnings: [] as string[],
    };
  }

  const result = buildVisiblePersons({
    viewerPersonId: input.profile?.person_id ?? null,
    role: input.profile?.role,
    editRootPersonId: input.profile?.edit_root_person_id ?? null,
    persons: input.persons,
    relationships: input.relationships ?? [],
    families: input.families ?? [],
    familyParents: input.familyParents ?? [],
    familyChildren: input.familyChildren ?? [],
  });

  return {
    isAdmin: false,
    isRestricted: true,
    viewerPersonId: input.profile?.person_id ?? null,
    visiblePersonIds: result.visiblePersonIds,
    editablePersonIds: result.editablePersonIds,
    warnings: result.warnings,
  };
}

export function filterGenealogyDataForProfile<
  TPerson extends PersonLike,
  TRelationship extends RelationshipLike,
  TFamily extends FamilyLike,
  TFamilyParent extends FamilyParentLike,
  TFamilyChild extends FamilyChildLike,
>(input: {
  profile: PermissionProfile | null | undefined;
  persons: TPerson[];
  relationships: TRelationship[];
  families: TFamily[];
  familyParents: TFamilyParent[];
  familyChildren: TFamilyChild[];
}): PermissionFilterResult<TPerson, TRelationship, TFamily, TFamilyParent, TFamilyChild> {
  const permission = buildVisiblePersonSetForProfile(input);

  if (permission.isAdmin) {
    return {
      ...permission,
      persons: input.persons,
      relationships: input.relationships,
      families: input.families,
      familyParents: input.familyParents,
      familyChildren: input.familyChildren,
    };
  }

  const visible = permission.visiblePersonIds;

  const persons = input.persons.filter((person) => visible.has(person.id));

  const relationships = input.relationships.filter((relationship) => {
    const personA = relationship.person_a;
    const personB = relationship.person_b;
    return Boolean(personA && personB && visible.has(personA) && visible.has(personB));
  });

  const familyParents = input.familyParents.filter((row) => visible.has(row.person_id));
  const familyChildren = input.familyChildren.filter((row) => visible.has(row.person_id));

  const visibleFamilyIds = new Set<string>();
  for (const row of familyParents) visibleFamilyIds.add(row.family_id);
  for (const row of familyChildren) visibleFamilyIds.add(row.family_id);

  const families = input.families.filter((family) => visibleFamilyIds.has(family.id));

  return {
    ...permission,
    persons,
    relationships,
    families,
    familyParents,
    familyChildren,
  };
}

export function resolvePermittedRootId(input: {
  requestedRootId?: string | null;
  fallbackRootId?: string | null;
  visiblePersonIds: Set<string>;
  persons: PersonLike[];
}) {
  if (input.requestedRootId && input.visiblePersonIds.has(input.requestedRootId)) {
    return input.requestedRootId;
  }

  if (input.fallbackRootId && input.visiblePersonIds.has(input.fallbackRootId)) {
    return input.fallbackRootId;
  }

  return input.persons[0]?.id ?? null;
}

export function filterPersonEventsForVisiblePersons<
  TPersonEvent extends { person_id: string; event_id: string; [key: string]: unknown },
  TEvent extends {
    id: string;
    legacy_person_id?: string | null;
    family_id?: string | null;
    deleted_at?: string | null;
    [key: string]: unknown;
  },
>(input: {
  personEvents: TPersonEvent[];
  events: TEvent[];
  visiblePersonIds: Set<string>;
  visibleFamilyIds?: Set<string>;
}) {
  const personEvents = input.personEvents.filter((personEvent) =>
    input.visiblePersonIds.has(personEvent.person_id),
  );

  const visibleEventIds = new Set(personEvents.map((personEvent) => personEvent.event_id));

  const events = input.events.filter((event) => {
    if (event.deleted_at) return false;

    if (visibleEventIds.has(event.id)) return true;

    if (event.legacy_person_id && input.visiblePersonIds.has(event.legacy_person_id)) {
      return true;
    }

    if (event.family_id && input.visibleFamilyIds?.has(event.family_id)) {
      return true;
    }

    return false;
  });

  const finalEventIds = new Set(events.map((event) => event.id));
  const finalPersonEvents = personEvents.filter((personEvent) =>
    finalEventIds.has(personEvent.event_id),
  );

  return { personEvents: finalPersonEvents, events };
}
