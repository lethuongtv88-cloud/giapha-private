export type PermissionRole = "admin" | "editor" | "member" | string | null | undefined;

export type PermissionPerson = {
  id: string;
  deleted_at?: string | null;
};

export type PermissionRelationship = {
  id?: string;
  type?: string | null;
  person_a?: string | null;
  person_b?: string | null;
  status?: string | null;
  deleted_at?: string | null;
};

export type PermissionFamily = {
  id: string;
  status?: string | null;
  deleted_at?: string | null;
};

export type PermissionFamilyParent = {
  family_id: string;
  person_id: string;
  role?: string | null;
};

export type PermissionFamilyChild = {
  family_id: string;
  person_id: string;
  relationship_type?: string | null;
};

export type PermissionEvent = {
  id: string;
  [key: string]: unknown;
};

export type PermissionPersonEvent = {
  person_id: string;
  event_id: string;
  [key: string]: unknown;
};

export type BuildVisiblePersonsInput = {
  viewerPersonId?: string | null;
  role?: PermissionRole;
  persons: PermissionPerson[];
  relationships?: PermissionRelationship[];
  families?: PermissionFamily[];
  familyParents?: PermissionFamilyParent[];
  familyChildren?: PermissionFamilyChild[];
  options?: {
    includeSpousesOfLineage?: boolean;
    includeDirectSpouseLineage?: boolean;
  };
};

export type VisibleReason =
  | "admin"
  | "self"
  | "lineage"
  | "lineage_spouse"
  | "direct_spouse"
  | "direct_spouse_lineage"
  | "direct_spouse_lineage_spouse";

export type VisiblePersonsResult = {
  visiblePersonIds: Set<string>;
  reasonByPersonId: Map<string, VisibleReason>;
  warnings: string[];
};

function isActiveRecord(record: { deleted_at?: string | null }) {
  return !record.deleted_at;
}

function addReason(
  visible: Set<string>,
  reasons: Map<string, VisibleReason>,
  personId: string | null | undefined,
  reason: VisibleReason,
) {
  if (!personId) return;
  visible.add(personId);
  if (!reasons.has(personId)) reasons.set(personId, reason);
}

function addUndirectedEdge(map: Map<string, Set<string>>, a?: string | null, b?: string | null) {
  if (!a || !b || a === b) return;
  if (!map.has(a)) map.set(a, new Set());
  if (!map.has(b)) map.set(b, new Set());
  map.get(a)!.add(b);
  map.get(b)!.add(a);
}

function addDirectedEdge(map: Map<string, Set<string>>, from?: string | null, to?: string | null) {
  if (!from || !to || from === to) return;
  if (!map.has(from)) map.set(from, new Set());
  map.get(from)!.add(to);
}

function collectReachable(start: string, graph: Map<string, Set<string>>) {
  const out = new Set<string>();
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (out.has(current)) continue;
    out.add(current);

    for (const next of graph.get(current) ?? []) {
      if (!out.has(next)) stack.push(next);
    }
  }

  return out;
}

function buildGraphs(input: BuildVisiblePersonsInput) {
  const activePersonIds = new Set(input.persons.filter(isActiveRecord).map((person) => person.id));
  const familyById = new Map(
    (input.families ?? [])
      .filter((family) => isActiveRecord(family))
      .map((family) => [family.id, family]),
  );

  const parentToChildren = new Map<string, Set<string>>();
  const childToParents = new Map<string, Set<string>>();
  const spouseGraph = new Map<string, Set<string>>();

  for (const rel of input.relationships ?? []) {
    if (!isActiveRecord(rel)) continue;
    if (!activePersonIds.has(rel.person_a ?? "") || !activePersonIds.has(rel.person_b ?? "")) {
      continue;
    }

    if (rel.type === "biological_child" || rel.type === "adopted_child") {
      addDirectedEdge(parentToChildren, rel.person_a, rel.person_b);
      addDirectedEdge(childToParents, rel.person_b, rel.person_a);
    }

    if (rel.type === "marriage") {
      addUndirectedEdge(spouseGraph, rel.person_a, rel.person_b);
    }
  }

  const parentsByFamily = new Map<string, string[]>();
  for (const parent of input.familyParents ?? []) {
    if (!familyById.has(parent.family_id)) continue;
    if (!activePersonIds.has(parent.person_id)) continue;
    parentsByFamily.set(parent.family_id, [
      ...(parentsByFamily.get(parent.family_id) ?? []),
      parent.person_id,
    ]);
  }

  for (const child of input.familyChildren ?? []) {
    if (!familyById.has(child.family_id)) continue;
    if (!activePersonIds.has(child.person_id)) continue;

    const parents = parentsByFamily.get(child.family_id) ?? [];
    for (const parentId of parents) {
      addDirectedEdge(parentToChildren, parentId, child.person_id);
      addDirectedEdge(childToParents, child.person_id, parentId);
    }

    for (let i = 0; i < parents.length; i += 1) {
      for (let j = i + 1; j < parents.length; j += 1) {
        addUndirectedEdge(spouseGraph, parents[i], parents[j]);
      }
    }
  }

  return { activePersonIds, parentToChildren, childToParents, spouseGraph };
}

function buildLineageScope(personId: string, graphs: ReturnType<typeof buildGraphs>) {
  const ancestors = collectReachable(personId, graphs.childToParents);
  const scope = new Set<string>();

  for (const ancestorId of ancestors) {
    for (const descendantId of collectReachable(ancestorId, graphs.parentToChildren)) {
      scope.add(descendantId);
    }
  }

  scope.add(personId);
  return scope;
}

function addLineageWithSpouses(
  scope: Set<string>,
  visible: Set<string>,
  reasons: Map<string, VisibleReason>,
  spouseGraph: Map<string, Set<string>>,
  lineageReason: VisibleReason,
  spouseReason: VisibleReason,
  includeSpouses: boolean,
) {
  for (const personId of scope) {
    addReason(visible, reasons, personId, lineageReason);
  }

  if (!includeSpouses) return;

  for (const personId of scope) {
    for (const spouseId of spouseGraph.get(personId) ?? []) {
      addReason(visible, reasons, spouseId, spouseReason);
    }
  }
}

export function buildVisiblePersons(input: BuildVisiblePersonsInput): VisiblePersonsResult {
  const warnings: string[] = [];
  const visiblePersonIds = new Set<string>();
  const reasonByPersonId = new Map<string, VisibleReason>();
  const graphs = buildGraphs(input);

  if (input.role === "admin") {
    for (const personId of graphs.activePersonIds) {
      addReason(visiblePersonIds, reasonByPersonId, personId, "admin");
    }
    return { visiblePersonIds, reasonByPersonId, warnings };
  }

  const viewerPersonId = input.viewerPersonId;
  if (!viewerPersonId) {
    warnings.push("Tài khoản chưa được gắn với người trong gia phả.");
    return { visiblePersonIds, reasonByPersonId, warnings };
  }

  if (!graphs.activePersonIds.has(viewerPersonId)) {
    warnings.push("Người được gắn với tài khoản không tồn tại hoặc đã bị xoá.");
    return { visiblePersonIds, reasonByPersonId, warnings };
  }

  const includeSpouses = input.options?.includeSpousesOfLineage ?? true;
  const includeDirectSpouseLineage = input.options?.includeDirectSpouseLineage ?? true;

  addReason(visiblePersonIds, reasonByPersonId, viewerPersonId, "self");

  const viewerLineage = buildLineageScope(viewerPersonId, graphs);
  addLineageWithSpouses(
    viewerLineage,
    visiblePersonIds,
    reasonByPersonId,
    graphs.spouseGraph,
    "lineage",
    "lineage_spouse",
    includeSpouses,
  );

  if (includeDirectSpouseLineage) {
    for (const spouseId of graphs.spouseGraph.get(viewerPersonId) ?? []) {
      addReason(visiblePersonIds, reasonByPersonId, spouseId, "direct_spouse");
      const spouseLineage = buildLineageScope(spouseId, graphs);
      addLineageWithSpouses(
        spouseLineage,
        visiblePersonIds,
        reasonByPersonId,
        graphs.spouseGraph,
        "direct_spouse_lineage",
        "direct_spouse_lineage_spouse",
        includeSpouses,
      );
    }
  }

  return { visiblePersonIds, reasonByPersonId, warnings };
}

export function filterPersonEventsByVisiblePersons<TPersonEvent extends PermissionPersonEvent, TEvent extends PermissionEvent>(input: {
  personEvents: TPersonEvent[];
  events: TEvent[];
  visiblePersonIds: Set<string>;
}) {
  const personEvents = input.personEvents.filter((personEvent) =>
    input.visiblePersonIds.has(personEvent.person_id),
  );
  const visibleEventIds = new Set(personEvents.map((personEvent) => personEvent.event_id));
  const events = input.events.filter((event) => visibleEventIds.has(event.id));

  return { personEvents, events };
}
