export type DataQualitySeverity = "error" | "warning" | "info";

export type DataQualityCategory =
  | "family"
  | "event"
  | "tree"
  | "stats"
  | "migration"
  | "legacy";

export interface DataQualityIssue {
  id: string;
  category: DataQualityCategory;
  severity: DataQualitySeverity;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  relatedIds?: string[];
  suggestion?: string;
}

export interface DataQualitySummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  byCategory: Record<DataQualityCategory, number>;
}

export interface DataQualityResult {
  summary: DataQualitySummary;
  issues: DataQualityIssue[];
  groups: Record<DataQualityCategory, DataQualityIssue[]>;
}

export interface DataQualityPerson {
  id: string;
  full_name?: string | null;
  gender?: string | null;
  is_deceased?: boolean | null;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  death_year?: number | null;
  death_month?: number | null;
  death_day?: number | null;
  deleted_at?: string | null;
}

export interface DataQualityRelationship {
  id?: string;
  type?: string | null;
  person_a?: string | null;
  person_b?: string | null;
  status?: string | null;
  deleted_at?: string | null;
}

export interface DataQualityFamily {
  id: string;
  status?: string | null;
  deleted_at?: string | null;
}

export interface DataQualityFamilyParent {
  id?: string;
  family_id: string;
  person_id: string;
  role?: string | null;
  sort_order?: number | null;
}

export interface DataQualityFamilyChild {
  id?: string;
  family_id: string;
  person_id: string;
  relationship_type?: string | null;
  sort_order?: number | null;
}

export interface DataQualityEvent {
  id: string;
  type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  sort_date?: string | null;
  date_precision?: string | null;
  legacy_person_id?: string | null;
  legacy_family_id?: string | null;
  family_id?: string | null;
  legacy_source?: string | null;
  deleted_at?: string | null;
}

export interface DataQualityPersonEvent {
  id?: string;
  person_id: string;
  event_id: string;
  role?: string | null;
}

export interface DataQualityMigrationReview {
  id?: string;
  status?: string | null;
  child_id?: string | null;
  suggested_family_id?: string | null;
  reason?: string | null;
}

export interface DataQualityInput {
  persons: DataQualityPerson[];
  relationships?: DataQualityRelationship[];
  families?: DataQualityFamily[];
  familyParents?: DataQualityFamilyParent[];
  familyChildren?: DataQualityFamilyChild[];
  events?: DataQualityEvent[];
  personEvents?: DataQualityPersonEvent[];
  migrationReview?: DataQualityMigrationReview[];
}

export function runDataQualityChecks(input: DataQualityInput): DataQualityResult {
  const issues: DataQualityIssue[] = [];

  const persons = input.persons ?? [];
  const relationships = input.relationships ?? [];
  const families = input.families ?? [];
  const familyParents = input.familyParents ?? [];
  const familyChildren = input.familyChildren ?? [];
  const events = input.events ?? [];
  const personEvents = input.personEvents ?? [];
  const migrationReview = input.migrationReview ?? [];

  const activePersons = persons.filter((person) => !person.deleted_at);
  const activePersonIds = new Set(activePersons.map((person) => person.id));
  const allPersonIds = new Set(persons.map((person) => person.id));
  const deletedPersonIds = new Set(
    persons.filter((person) => person.deleted_at).map((person) => person.id),
  );

  const activeFamilies = families.filter((family) => !family.deleted_at);
  const activeFamilyIds = new Set(activeFamilies.map((family) => family.id));

  const activeEvents = events.filter((event) => !event.deleted_at);
  const activeEventIds = new Set(activeEvents.map((event) => event.id));

  checkFamilyQuality({
    issues,
    activePersonIds,
    allPersonIds,
    activeFamilyIds,
    deletedPersonIds,
    activeFamilies,
    familyParents,
    familyChildren,
  });

  checkEventQuality({
    issues,
    activePersonIds,
    activeFamilyIds,
    activeEvents,
    activeEventIds,
    personEvents,
    activePersons,
  });

  checkTreeQuality({
    issues,
    activePersonIds,
    allPersonIds,
    deletedPersonIds,
    relationships,
    familyParents,
    familyChildren,
    activeFamilyIds,
  });

  checkMigrationReview({
    issues,
    migrationReview,
  });

  checkLegacyQuality({
    issues,
    persons,
    relationships,
  });

  checkStatsAndGraphWarnings({
    issues,
    activePersonIds,
    familyParents,
    familyChildren,
    activeFamilyIds,
  });

  return buildResult(issues);
}

function checkFamilyQuality(input: {
  issues: DataQualityIssue[];
  activePersonIds: Set<string>;
  allPersonIds: Set<string>;
  activeFamilyIds: Set<string>;
  deletedPersonIds: Set<string>;
  activeFamilies: DataQualityFamily[];
  familyParents: DataQualityFamilyParent[];
  familyChildren: DataQualityFamilyChild[];
}) {
  const parentsByFamily = groupBy(input.familyParents, (row) => row.family_id);
  const childrenByFamily = groupBy(input.familyChildren, (row) => row.family_id);

  for (const family of input.activeFamilies) {
    const parents = parentsByFamily.get(family.id) ?? [];
    const children = childrenByFamily.get(family.id) ?? [];

    if (parents.length === 0) {
      input.issues.push({
        id: `family:${family.id}:no-parent`,
        category: "family",
        severity: children.length > 0 ? "error" : "warning",
        title: children.length > 0 ? "Family có con nhưng không có cha/mẹ" : "Family không có cha/mẹ",
        description:
          children.length > 0
            ? `Family ${family.id} có ${children.length} child nhưng không có parent trong family_parents.`
            : `Family ${family.id} không có parent. Có thể là family rỗng hoặc dữ liệu chưa hoàn chỉnh.`,
        entityType: "family",
        entityId: family.id,
        relatedIds: children.map((child) => child.person_id),
        suggestion: "Kiểm tra family_parents hoặc migration_review cho family này.",
      });
    }

    for (const parent of parents) {
      if (!input.allPersonIds.has(parent.person_id)) {
        input.issues.push({
          id: `family_parent:${family.id}:${parent.person_id}:missing-person`,
          category: "family",
          severity: "error",
          title: "Family parent trỏ tới person không tồn tại",
          description: `family_parents trong family ${family.id} trỏ tới person ${parent.person_id}, nhưng person này không tồn tại.`,
          entityType: "family",
          entityId: family.id,
          relatedIds: [parent.person_id],
          suggestion: "Xóa parent edge sai hoặc khôi phục person bị thiếu.",
        });
      } else if (input.deletedPersonIds.has(parent.person_id)) {
        input.issues.push({
          id: `family_parent:${family.id}:${parent.person_id}:deleted-person`,
          category: "family",
          severity: "error",
          title: "Family parent trỏ tới person đã bị soft-delete",
          description: `family ${family.id} có parent ${parent.person_id} đã bị soft-delete.`,
          entityType: "family",
          entityId: family.id,
          relatedIds: [parent.person_id],
          suggestion: "Family graph chỉ nên dùng persons active.",
        });
      }
    }

    for (const child of children) {
      if (!input.allPersonIds.has(child.person_id)) {
        input.issues.push({
          id: `family_child:${family.id}:${child.person_id}:missing-person`,
          category: "family",
          severity: "error",
          title: "Family child trỏ tới person không tồn tại",
          description: `family_children trong family ${family.id} trỏ tới person ${child.person_id}, nhưng person này không tồn tại.`,
          entityType: "family",
          entityId: family.id,
          relatedIds: [child.person_id],
          suggestion: "Xóa child edge sai hoặc khôi phục person bị thiếu.",
        });
      } else if (input.deletedPersonIds.has(child.person_id)) {
        input.issues.push({
          id: `family_child:${family.id}:${child.person_id}:deleted-person`,
          category: "family",
          severity: "error",
          title: "Family child trỏ tới person đã bị soft-delete",
          description: `family ${family.id} có child ${child.person_id} đã bị soft-delete.`,
          entityType: "family",
          entityId: family.id,
          relatedIds: [child.person_id],
          suggestion: "Family graph chỉ nên dùng persons active.",
        });
      }
    }
  }

  const biologicalFamiliesByChild = new Map<string, Set<string>>();

  for (const child of input.familyChildren) {
    if (!input.activeFamilyIds.has(child.family_id)) continue;
    if (!input.activePersonIds.has(child.person_id)) continue;

    const relationshipType = child.relationship_type ?? "biological";
    if (relationshipType !== "biological" && relationshipType !== "birth" && relationshipType !== "certain") {
      continue;
    }

    const set = biologicalFamiliesByChild.get(child.person_id) ?? new Set<string>();
    set.add(child.family_id);
    biologicalFamiliesByChild.set(child.person_id, set);
  }

  for (const [childId, familyIds] of biologicalFamiliesByChild.entries()) {
    if (familyIds.size > 1) {
      input.issues.push({
        id: `family_child:${childId}:multiple-biological-families`,
        category: "family",
        severity: "warning",
        title: "Child thuộc nhiều biological family",
        description: `Person ${childId} đang thuộc ${familyIds.size} family biological/certain. Có thể đúng trong một số trường hợp đặc biệt, nhưng cần kiểm tra.`,
        entityType: "person",
        entityId: childId,
        relatedIds: Array.from(familyIds),
        suggestion: "Xác nhận biological/adopted/step relationship_type cho các family_children.",
      });
    }
  }
}

function checkEventQuality(input: {
  issues: DataQualityIssue[];
  activePersonIds: Set<string>;
  activeFamilyIds: Set<string>;
  activeEvents: DataQualityEvent[];
  activeEventIds: Set<string>;
  personEvents: DataQualityPersonEvent[];
  activePersons: DataQualityPerson[];
}) {
  for (const personEvent of input.personEvents) {
    const personEventId =
      personEvent.id ?? `${personEvent.person_id}:${personEvent.event_id}`;

    if (!input.activeEventIds.has(personEvent.event_id)) {
      input.issues.push({
        id: `person_event:${personEventId}:missing-event`,
        category: "event",
        severity: "error",
        title: "Person event trỏ tới event không tồn tại hoặc đã bị xóa",
        description: `person_events ${personEventId} trỏ tới event ${personEvent.event_id}, nhưng event này không active.`,
        entityType: "event",
        entityId: personEvent.event_id,
        relatedIds: [personEvent.person_id],
        suggestion: "Xóa liên kết person_events sai hoặc khôi phục event.",
      });
    }

    if (!input.activePersonIds.has(personEvent.person_id)) {
      input.issues.push({
        id: `person_event:${personEventId}:missing-person`,
        category: "event",
        severity: "error",
        title: "Person event trỏ tới person không tồn tại hoặc đã bị xóa",
        description: `person_events ${personEventId} trỏ tới person ${personEvent.person_id}, nhưng person này không active.`,
        entityType: "person",
        entityId: personEvent.person_id,
        relatedIds: [personEvent.event_id],
        suggestion: "Xóa liên kết person_events sai hoặc khôi phục person.",
      });
    }
  }

  for (const event of input.activeEvents) {
    if (event.start_date && event.end_date && event.end_date < event.start_date) {
      input.issues.push({
        id: `event:${event.id}:invalid-range`,
        category: "event",
        severity: "error",
        title: "Event có end_date nhỏ hơn start_date",
        description: `Event ${event.id} có start_date=${event.start_date}, end_date=${event.end_date}.`,
        entityType: "event",
        entityId: event.id,
        suggestion: "Sửa lại normalizeDate hoặc dữ liệu event.",
      });
    }
  }

  const eventIdsWithPerson = new Set(
    input.personEvents
      .filter((pe) => input.activeEventIds.has(pe.event_id))
      .map((pe) => pe.event_id),
  );

  for (const event of input.activeEvents) {
    const hasFamily = Boolean(event.family_id && input.activeFamilyIds.has(event.family_id));
    const hasLegacyPerson = Boolean(
      event.legacy_person_id && input.activePersonIds.has(event.legacy_person_id),
    );
    const hasPersonEvent = eventIdsWithPerson.has(event.id);

    if (!hasFamily && !hasLegacyPerson && !hasPersonEvent) {
      input.issues.push({
        id: `event:${event.id}:orphan`,
        category: "event",
        severity: "error",
        title: "Event orphan không gắn person/family",
        description: `Event ${event.id} không có family active, không có legacy_person_id active, và không có person_events active.`,
        entityType: "event",
        entityId: event.id,
        suggestion: "Gắn event vào person_events/family_id hoặc xóa event sai nếu là migration lỗi.",
      });
    }
  }

  const birthEventsByPerson = collectPersonEventsByType({
    eventType: "birth",
    activeEvents: input.activeEvents,
    personEvents: input.personEvents,
  });

  const deathEventsByPerson = collectPersonEventsByType({
    eventType: "death",
    activeEvents: input.activeEvents,
    personEvents: input.personEvents,
  });

  for (const [personId, events] of birthEventsByPerson.entries()) {
    if (events.length > 1) {
      input.issues.push({
        id: `person:${personId}:duplicate-birth-events`,
        category: "event",
        severity: "warning",
        title: "Person có nhiều birth events",
        description: `Person ${personId} có ${events.length} birth events active.`,
        entityType: "person",
        entityId: personId,
        relatedIds: events.map((event) => event.id),
        suggestion: "GEDCOM exporter chỉ dùng event đầu tiên; nên giữ một birth event chính.",
      });
    }
  }

  for (const [personId, events] of deathEventsByPerson.entries()) {
    if (events.length > 1) {
      input.issues.push({
        id: `person:${personId}:duplicate-death-events`,
        category: "event",
        severity: "warning",
        title: "Person có nhiều death events",
        description: `Person ${personId} có ${events.length} death events active.`,
        entityType: "person",
        entityId: personId,
        relatedIds: events.map((event) => event.id),
        suggestion: "GEDCOM exporter chỉ dùng event đầu tiên; nên giữ một death event chính.",
      });
    }
  }

  for (const person of input.activePersons) {
    const birthEvent = birthEventsByPerson.get(person.id)?.[0] ?? null;
    const deathEvent = deathEventsByPerson.get(person.id)?.[0] ?? null;

    if (birthEvent?.start_date && deathEvent?.start_date && deathEvent.start_date < birthEvent.start_date) {
      input.issues.push({
        id: `person:${person.id}:death-before-birth`,
        category: "event",
        severity: "error",
        title: "Ngày mất trước ngày sinh",
        description: `Person ${person.id} có death event trước birth event.`,
        entityType: "person",
        entityId: person.id,
        relatedIds: [birthEvent.id, deathEvent.id],
        suggestion: "Kiểm tra lại ngày sinh/ngày mất hoặc date precision.",
      });
    }

    const hasLegacyDeathDate = Boolean(person.death_year || person.death_month || person.death_day);

    if (person.is_deceased === true && !deathEvent && !hasLegacyDeathDate) {
      input.issues.push({
        id: `person:${person.id}:deceased-without-death-date`,
        category: "event",
        severity: "info",
        title: "Người đã mất nhưng chưa có ngày mất",
        description: `Person ${person.id} có is_deceased=true nhưng chưa có death event hoặc legacy death date.`,
        entityType: "person",
        entityId: person.id,
        suggestion: "UI nên hiển thị birth – ?, không tính tuổi hiện tại.",
      });
    }
  }
}

function checkTreeQuality(input: {
  issues: DataQualityIssue[];
  activePersonIds: Set<string>;
  allPersonIds: Set<string>;
  deletedPersonIds: Set<string>;
  relationships: DataQualityRelationship[];
  familyParents: DataQualityFamilyParent[];
  familyChildren: DataQualityFamilyChild[];
  activeFamilyIds: Set<string>;
}) {
  for (const rel of input.relationships) {
    if (rel.deleted_at) continue;

    const relId = rel.id ?? `${rel.type}:${rel.person_a}:${rel.person_b}`;

    if (rel.person_a && !input.allPersonIds.has(rel.person_a)) {
      input.issues.push({
        id: `relationship:${relId}:missing-person-a`,
        category: "tree",
        severity: "error",
        title: "Relationship trỏ tới person_a không tồn tại",
        description: `Relationship ${relId} trỏ tới person_a=${rel.person_a}, nhưng person này không tồn tại.`,
        entityType: "relationship",
        entityId: rel.id,
        relatedIds: [rel.person_a],
        suggestion: "Xóa relationship sai hoặc khôi phục person.",
      });
    }

    if (rel.person_b && !input.allPersonIds.has(rel.person_b)) {
      input.issues.push({
        id: `relationship:${relId}:missing-person-b`,
        category: "tree",
        severity: "error",
        title: "Relationship trỏ tới person_b không tồn tại",
        description: `Relationship ${relId} trỏ tới person_b=${rel.person_b}, nhưng person này không tồn tại.`,
        entityType: "relationship",
        entityId: rel.id,
        relatedIds: [rel.person_b],
        suggestion: "Xóa relationship sai hoặc khôi phục person.",
      });
    }

    if (rel.person_a && input.deletedPersonIds.has(rel.person_a)) {
      input.issues.push({
        id: `relationship:${relId}:deleted-person-a`,
        category: "tree",
        severity: "error",
        title: "Relationship active trỏ tới person_a đã soft-delete",
        description: `Relationship ${relId} vẫn active nhưng person_a=${rel.person_a} đã soft-delete.`,
        entityType: "relationship",
        entityId: rel.id,
        relatedIds: [rel.person_a],
        suggestion: "relationships_active không nên trả edge có person đã deleted.",
      });
    }

    if (rel.person_b && input.deletedPersonIds.has(rel.person_b)) {
      input.issues.push({
        id: `relationship:${relId}:deleted-person-b`,
        category: "tree",
        severity: "error",
        title: "Relationship active trỏ tới person_b đã soft-delete",
        description: `Relationship ${relId} vẫn active nhưng person_b=${rel.person_b} đã soft-delete.`,
        entityType: "relationship",
        entityId: rel.id,
        relatedIds: [rel.person_b],
        suggestion: "relationships_active không nên trả edge có person đã deleted.",
      });
    }
  }

  const parentChildEdges = buildParentChildEdgesForCycleCheck({
    familyParents: input.familyParents,
    familyChildren: input.familyChildren,
    activeFamilyIds: input.activeFamilyIds,
    activePersonIds: input.activePersonIds,
  });

  const cycle = findParentChildCycle(parentChildEdges);
  if (cycle.length > 0) {
    input.issues.push({
      id: `tree:parent-child-cycle:${cycle.join("-")}`,
      category: "tree",
      severity: "error",
      title: "Có vòng lặp parent-child trong Family Model",
      description: `Phát hiện vòng lặp parent-child: ${cycle.join(" → ")}.`,
      entityType: "tree",
      relatedIds: cycle,
      suggestion: "Sửa family_children/family_parents để không có người vừa là tổ tiên vừa là hậu duệ của chính mình.",
    });
  }
}

function checkMigrationReview(input: {
  issues: DataQualityIssue[];
  migrationReview: DataQualityMigrationReview[];
}) {
  const pending = input.migrationReview.filter((row) => row.status === "pending");
  const skipped = input.migrationReview.filter((row) => row.status === "skipped");

  if (pending.length > 0) {
    input.issues.push({
      id: "migration_review:pending",
      category: "migration",
      severity: "warning",
      title: "Còn migration_review pending",
      description: `Còn ${pending.length} case migration_review status=pending.`,
      entityType: "migration_review",
      relatedIds: pending.map((row) => row.id).filter(Boolean) as string[],
      suggestion: "Xử lý dần từng case pending, không rollback Family Model.",
    });
  }

  if (skipped.length > 0) {
    input.issues.push({
      id: "migration_review:skipped",
      category: "migration",
      severity: "info",
      title: "Có migration_review skipped",
      description: `Có ${skipped.length} case migration_review status=skipped.`,
      entityType: "migration_review",
      relatedIds: skipped.map((row) => row.id).filter(Boolean) as string[],
      suggestion: "Kiểm tra lại nếu muốn tăng độ hoàn chỉnh của family_children.",
    });
  }
}

function checkLegacyQuality(input: {
  issues: DataQualityIssue[];
  persons: DataQualityPerson[];
  relationships: DataQualityRelationship[];
}) {
  const softDeletedPersons = input.persons.filter((person) => person.deleted_at);
  const softDeletedRelationships = input.relationships.filter((rel) => rel.deleted_at);

  if (softDeletedPersons.length > 0) {
    input.issues.push({
      id: "legacy:soft-deleted-persons-exist",
      category: "legacy",
      severity: "info",
      title: "Có persons đã soft-delete",
      description: `Có ${softDeletedPersons.length} person đã soft-delete. Đây không phải lỗi nếu UI dùng persons_active.`,
      entityType: "persons",
      relatedIds: softDeletedPersons.map((person) => person.id),
      suggestion: "Không hard-delete nếu chưa bật ALLOW_LEGACY_CLEANUP.",
    });
  }

  if (softDeletedRelationships.length > 0) {
    input.issues.push({
      id: "legacy:soft-deleted-relationships-exist",
      category: "legacy",
      severity: "info",
      title: "Có relationships đã soft-delete",
      description: `Có ${softDeletedRelationships.length} relationship đã soft-delete. Đây không phải lỗi nếu UI dùng relationships_active.`,
      entityType: "relationships",
      relatedIds: softDeletedRelationships.map((rel) => rel.id).filter(Boolean) as string[],
      suggestion: "Không hard-delete nếu chưa bật ALLOW_LEGACY_CLEANUP.",
    });
  }
}

function checkStatsAndGraphWarnings(input: {
  issues: DataQualityIssue[];
  activePersonIds: Set<string>;
  familyParents: DataQualityFamilyParent[];
  familyChildren: DataQualityFamilyChild[];
  activeFamilyIds: Set<string>;
}) {
  const parentChildEdges = buildParentChildEdgesForCycleCheck({
    familyParents: input.familyParents,
    familyChildren: input.familyChildren,
    activeFamilyIds: input.activeFamilyIds,
    activePersonIds: input.activePersonIds,
  });

  const parentsByChild = new Map<string, Set<string>>();

  for (const edge of parentChildEdges) {
    const set = parentsByChild.get(edge.childId) ?? new Set<string>();
    set.add(edge.parentId);
    parentsByChild.set(edge.childId, set);
  }

  for (const [childId, parentIds] of parentsByChild.entries()) {
    if (parentIds.size > 2) {
      input.issues.push({
        id: `stats:${childId}:more-than-two-parents`,
        category: "stats",
        severity: "warning",
        title: "Root/dual stats có thể phân loại khó vì child có hơn 2 parents",
        description: `Person ${childId} có ${parentIds.size} parents active trong Family Model.`,
        entityType: "person",
        entityId: childId,
        relatedIds: Array.from(parentIds),
        suggestion: "Kiểm tra role/relationship_type để root classifier và dual ancestry phân loại chính xác.",
      });
    }
  }
}

function collectPersonEventsByType(input: {
  eventType: "birth" | "death";
  activeEvents: DataQualityEvent[];
  personEvents: DataQualityPersonEvent[];
}): Map<string, DataQualityEvent[]> {
  const out = new Map<string, DataQualityEvent[]>();
  const eventsById = new Map(input.activeEvents.map((event) => [event.id, event]));

  for (const pe of input.personEvents) {
    const event = eventsById.get(pe.event_id);
    if (!event || event.type !== input.eventType) continue;

    const arr = out.get(pe.person_id) ?? [];
    arr.push(event);
    out.set(pe.person_id, arr);
  }

  for (const event of input.activeEvents) {
    if (event.type !== input.eventType) continue;
    if (!event.legacy_person_id) continue;

    const arr = out.get(event.legacy_person_id) ?? [];
    if (!arr.some((existing) => existing.id === event.id)) {
      arr.push(event);
    }
    out.set(event.legacy_person_id, arr);
  }

  for (const arr of out.values()) {
    arr.sort((a, b) => {
      const ad = a.sort_date ?? a.start_date ?? "";
      const bd = b.sort_date ?? b.start_date ?? "";
      return ad.localeCompare(bd);
    });
  }

  return out;
}

function buildParentChildEdgesForCycleCheck(input: {
  familyParents: DataQualityFamilyParent[];
  familyChildren: DataQualityFamilyChild[];
  activeFamilyIds: Set<string>;
  activePersonIds: Set<string>;
}): Array<{ parentId: string; childId: string }> {
  const parentsByFamily = groupBy(input.familyParents, (row) => row.family_id);
  const out: Array<{ parentId: string; childId: string }> = [];

  for (const child of input.familyChildren) {
    if (!input.activeFamilyIds.has(child.family_id)) continue;
    if (!input.activePersonIds.has(child.person_id)) continue;

    const parents = parentsByFamily.get(child.family_id) ?? [];

    for (const parent of parents) {
      if (!input.activePersonIds.has(parent.person_id)) continue;

      out.push({
        parentId: parent.person_id,
        childId: child.person_id,
      });
    }
  }

  return dedupeEdges(out);
}

function findParentChildCycle(
  edges: Array<{ parentId: string; childId: string }>,
): string[] {
  const childrenByParent = groupBy(edges, (edge) => edge.parentId);

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(personId: string): string[] | null {
    if (visiting.has(personId)) {
      const idx = stack.indexOf(personId);
      return idx >= 0 ? stack.slice(idx).concat(personId) : [personId];
    }

    if (visited.has(personId)) return null;

    visiting.add(personId);
    stack.push(personId);

    for (const edge of childrenByParent.get(personId) ?? []) {
      const cycle = dfs(edge.childId);
      if (cycle) return cycle;
    }

    stack.pop();
    visiting.delete(personId);
    visited.add(personId);

    return null;
  }

  const allIds = new Set<string>();
  for (const edge of edges) {
    allIds.add(edge.parentId);
    allIds.add(edge.childId);
  }

  for (const personId of allIds) {
    const cycle = dfs(personId);
    if (cycle) return cycle;
  }

  return [];
}

function buildResult(issues: DataQualityIssue[]): DataQualityResult {
  const groups: Record<DataQualityCategory, DataQualityIssue[]> = {
    family: [],
    event: [],
    tree: [],
    stats: [],
    migration: [],
    legacy: [],
  };

  for (const issue of issues) {
    groups[issue.category].push(issue);
  }

  const summary: DataQualitySummary = {
    total: issues.length,
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
    byCategory: {
      family: groups.family.length,
      event: groups.event.length,
      tree: groups.tree.length,
      stats: groups.stats.length,
      migration: groups.migration.length,
      legacy: groups.legacy.length,
    },
  };

  return {
    summary,
    issues,
    groups,
  };
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const arr = out.get(key) ?? [];
    arr.push(item);
    out.set(key, arr);
  }

  return out;
}

function dedupeEdges(
  edges: Array<{ parentId: string; childId: string }>,
): Array<{ parentId: string; childId: string }> {
  const seen = new Set<string>();
  const out: Array<{ parentId: string; childId: string }> = [];

  for (const edge of edges) {
    const key = `${edge.parentId}->${edge.childId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }

  return out;
}
