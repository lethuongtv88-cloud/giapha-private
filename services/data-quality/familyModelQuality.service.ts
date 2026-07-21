export type FamilyModelQualitySeverity = "error" | "warning" | "info";

export type FamilyModelQualityKind =
  | "missing_marriage_family"
  | "missing_child_family"
  | "duplicate_family_parent"
  | "duplicate_family_child"
  | "family_child_without_parent"
  | "active_empty_family"
  | "person_parent_and_child_same_family"
  | "family_more_than_two_parents"
  | "child_multiple_biological_families"
  | "child_more_than_two_biological_parents"
  | "relationship_points_to_deleted_person"
  | "family_edge_points_to_deleted_person";

export interface FamilyModelQualityPerson {
  id: string;
  full_name?: string | null;
  gender?: string | null;
  deleted_at?: string | null;
}

export interface FamilyModelQualityRelationship {
  id?: string | null;
  type?: string | null;
  person_a?: string | null;
  person_b?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
}

export interface FamilyModelQualityFamily {
  id: string;
  status?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FamilyModelQualityFamilyParent {
  id?: string | null;
  family_id: string;
  person_id: string;
  role?: string | null;
  sort_order?: number | null;
}

export interface FamilyModelQualityFamilyChild {
  id?: string | null;
  family_id: string;
  person_id: string;
  relationship_type?: string | null;
  sort_order?: number | null;
  legacy_relationship_id?: string | null;
  migration_confidence?: string | null;
}

export interface FamilyModelQualityInput {
  persons: FamilyModelQualityPerson[];
  relationships?: FamilyModelQualityRelationship[];
  families?: FamilyModelQualityFamily[];
  familyParents?: FamilyModelQualityFamilyParent[];
  familyChildren?: FamilyModelQualityFamilyChild[];
}

export interface FamilyModelQualityIssue {
  id: string;
  kind: FamilyModelQualityKind;
  severity: FamilyModelQualitySeverity;
  title: string;
  description: string;
  repairable: boolean;
  personIds?: string[];
  familyIds?: string[];
  relationshipIds?: string[];
  details?: Record<string, string | number | null | undefined>;
  repairHint?: string;
}

export interface FamilyModelQualitySummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  repairable: number;
  byKind: Record<FamilyModelQualityKind, number>;
}

export interface FamilyModelQualityResult {
  summary: FamilyModelQualitySummary;
  issues: FamilyModelQualityIssue[];
  groups: Record<FamilyModelQualityKind, FamilyModelQualityIssue[]>;
}

const allKinds: FamilyModelQualityKind[] = [
  "missing_marriage_family",
  "missing_child_family",
  "duplicate_family_parent",
  "duplicate_family_child",
  "family_child_without_parent",
  "active_empty_family",
  "person_parent_and_child_same_family",
  "family_more_than_two_parents",
  "child_multiple_biological_families",
  "child_more_than_two_biological_parents",
  "relationship_points_to_deleted_person",
  "family_edge_points_to_deleted_person",
];

export const familyModelKindLabels: Record<FamilyModelQualityKind, string> = {
  missing_marriage_family: "Thiếu Family Model hôn nhân",
  missing_child_family: "Thiếu Family Model con cái",
  duplicate_family_parent: "Trùng family_parents",
  duplicate_family_child: "Trùng family_children",
  family_child_without_parent: "Family có con không có cha/mẹ",
  active_empty_family: "Family rỗng active",
  person_parent_and_child_same_family: "Một người vừa parent vừa child trong family",
  family_more_than_two_parents: "Family có hơn 2 parent",
  child_multiple_biological_families: "Child thuộc nhiều biological family",
  child_more_than_two_biological_parents: "Child có hơn 2 cha/mẹ biological",
  relationship_points_to_deleted_person: "Relationship trỏ tới người đã xóa",
  family_edge_points_to_deleted_person: "Family edge trỏ tới người đã xóa",
};

export const familyModelRepairSql = {
  missingMarriage: `SELECT public.ensure_family_model_marriage(r.person_a, r.person_b) AS family_id\nFROM public.relationships r\nWHERE r.deleted_at IS NULL\n  AND r.type = 'marriage'\n  AND NOT EXISTS (\n    SELECT 1\n    FROM public.family_parents fp1\n    JOIN public.family_parents fp2\n      ON fp2.family_id = fp1.family_id\n    JOIN public.families f\n      ON f.id = fp1.family_id\n     AND f.deleted_at IS NULL\n    WHERE fp1.person_id = r.person_a\n      AND fp2.person_id = r.person_b\n  );`,
  missingChild: `WITH missing AS (\n  SELECT\n    r.person_a AS parent_a,\n    r.person_b AS child_id,\n    (\n      SELECT r2.person_a\n      FROM public.relationships r2\n      WHERE r2.deleted_at IS NULL\n        AND r2.type IN ('biological_child', 'adopted_child')\n        AND r2.person_b = r.person_b\n        AND r2.person_a <> r.person_a\n      ORDER BY r2.created_at ASC NULLS LAST\n      LIMIT 1\n    ) AS parent_b\n  FROM public.relationships r\n  WHERE r.deleted_at IS NULL\n    AND r.type IN ('biological_child', 'adopted_child')\n    AND NOT EXISTS (\n      SELECT 1\n      FROM public.family_children fc\n      JOIN public.family_parents fp\n        ON fp.family_id = fc.family_id\n      JOIN public.families f\n        ON f.id = fc.family_id\n       AND f.deleted_at IS NULL\n      WHERE fp.person_id = r.person_a\n        AND fc.person_id = r.person_b\n    )\n)\nSELECT\n  parent_a,\n  parent_b,\n  child_id,\n  public.ensure_family_model_child(parent_a, child_id, parent_b) AS family_id\nFROM missing;`,
  duplicateParentsPreview: `BEGIN;\n\nSELECT family_id, person_id, COUNT(*) AS duplicate_count\nFROM public.family_parents\nGROUP BY family_id, person_id\nHAVING COUNT(*) > 1\nORDER BY duplicate_count DESC;\n\nCOMMIT;`,
  duplicateChildrenPreview: `BEGIN;\n\nSELECT family_id, person_id, relationship_type, COUNT(*) AS duplicate_count\nFROM public.family_children\nGROUP BY family_id, person_id, relationship_type\nHAVING COUNT(*) > 1\nORDER BY duplicate_count DESC;\n\nCOMMIT;`,
  dedupeFamilyParents: `BEGIN;\nWITH ranked AS (\n  SELECT\n    ctid,\n    ROW_NUMBER() OVER (\n      PARTITION BY family_id, person_id\n      ORDER BY id ASC NULLS LAST, ctid ASC\n    ) AS rn\n  FROM public.family_parents\n)\nDELETE FROM public.family_parents fp\nUSING ranked r\nWHERE fp.ctid = r.ctid\n  AND r.rn > 1;\nCOMMIT;`,
  dedupeFamilyChildren: `BEGIN;\nWITH ranked AS (\n  SELECT\n    ctid,\n    ROW_NUMBER() OVER (\n      PARTITION BY family_id, person_id, COALESCE(relationship_type, 'biological')\n      ORDER BY id ASC NULLS LAST, ctid ASC\n    ) AS rn\n  FROM public.family_children\n)\nDELETE FROM public.family_children fc\nUSING ranked r\nWHERE fc.ctid = r.ctid\n  AND r.rn > 1;\nCOMMIT;`,
  emptyFamiliesPreview: `BEGIN;\n\nSELECT f.id, f.status, f.created_at, f.updated_at\nFROM public.families f\nLEFT JOIN public.family_parents fp ON fp.family_id = f.id\nLEFT JOIN public.family_children fc ON fc.family_id = f.id\nWHERE f.deleted_at IS NULL\nGROUP BY f.id, f.status, f.created_at, f.updated_at\nHAVING COUNT(fp.*) = 0 AND COUNT(fc.*) = 0\nORDER BY f.created_at DESC;\n\nCOMMIT;`,
} as const;

export function runFamilyModelQualityChecks(
  input: FamilyModelQualityInput,
): FamilyModelQualityResult {
  const issues: FamilyModelQualityIssue[] = [];
  const persons = input.persons ?? [];
  const relationships = input.relationships ?? [];
  const families = input.families ?? [];
  const familyParents = input.familyParents ?? [];
  const familyChildren = input.familyChildren ?? [];

  const personById = new Map(persons.map((person) => [person.id, person]));
  const activePersonIds = new Set(
    persons.filter((person) => !person.deleted_at).map((person) => person.id),
  );
  const deletedPersonIds = new Set(
    persons.filter((person) => person.deleted_at).map((person) => person.id),
  );
  const activeFamilies = families.filter((family) => !family.deleted_at);
  const activeFamilyIds = new Set(activeFamilies.map((family) => family.id));
  const parentsByFamily = groupBy(
    familyParents.filter((row) => activeFamilyIds.has(row.family_id)),
    (row) => row.family_id,
  );
  const childrenByFamily = groupBy(
    familyChildren.filter((row) => activeFamilyIds.has(row.family_id)),
    (row) => row.family_id,
  );

  checkMissingLegacySync({
    issues,
    relationships,
    activePersonIds,
    deletedPersonIds,
    familyParents,
    familyChildren,
    activeFamilyIds,
  });

  checkDuplicateFamilyRows({ issues, familyParents, familyChildren, activeFamilyIds });

  for (const family of activeFamilies) {
    const parents = parentsByFamily.get(family.id) ?? [];
    const children = childrenByFamily.get(family.id) ?? [];

    if (parents.length === 0 && children.length === 0) {
      issues.push({
        id: `family:${family.id}:active-empty`,
        kind: "active_empty_family",
        severity: "warning",
        title: familyModelKindLabels.active_empty_family,
        description: `Family ${family.id} active nhưng không có parent và không có child.`,
        repairable: true,
        familyIds: [family.id],
        repairHint: "Có thể soft-delete nếu đây là family rỗng sau migration/import.",
      });
    }

    if (parents.length === 0 && children.length > 0) {
      issues.push({
        id: `family:${family.id}:child-without-parent`,
        kind: "family_child_without_parent",
        severity: "error",
        title: familyModelKindLabels.family_child_without_parent,
        description: `Family ${family.id} có ${children.length} child nhưng không có parent.`,
        repairable: false,
        familyIds: [family.id],
        personIds: children.map((child) => child.person_id),
        repairHint: "Cần xem chi tiết để gắn đúng cha/mẹ; không nên auto-repair.",
      });
    }

    if (parents.length > 2) {
      issues.push({
        id: `family:${family.id}:more-than-two-parents`,
        kind: "family_more_than_two_parents",
        severity: "warning",
        title: familyModelKindLabels.family_more_than_two_parents,
        description: `Family ${family.id} có ${parents.length} parent. GEDCOM chuẩn chỉ có HUSB/WIFE, parent dư sẽ phải export bằng ASSO.`,
        repairable: false,
        familyIds: [family.id],
        personIds: parents.map((parent) => parent.person_id),
        repairHint: "Kiểm tra đây là đa phu/đa thê thật hay dữ liệu bị gộp nhầm.",
      });
    }

    const parentIds = new Set(parents.map((parent) => parent.person_id));
    const samePersonRows = children.filter((child) => parentIds.has(child.person_id));
    for (const row of samePersonRows) {
      issues.push({
        id: `family:${family.id}:person:${row.person_id}:parent-and-child`,
        kind: "person_parent_and_child_same_family",
        severity: "error",
        title: familyModelKindLabels.person_parent_and_child_same_family,
        description: `${formatPerson(row.person_id, personById)} vừa là parent vừa là child trong family ${family.id}.`,
        repairable: false,
        familyIds: [family.id],
        personIds: [row.person_id],
        repairHint: "Cần sửa tay family_parents/family_children để tránh vòng quan hệ.",
      });
    }

    for (const parent of parents) {
      if (deletedPersonIds.has(parent.person_id)) {
        issues.push({
          id: `family_parent:${family.id}:${parent.person_id}:deleted-person`,
          kind: "family_edge_points_to_deleted_person",
          severity: "error",
          title: familyModelKindLabels.family_edge_points_to_deleted_person,
          description: `family_parents trong family ${family.id} trỏ tới person đã soft-delete: ${formatPerson(parent.person_id, personById)}.`,
          repairable: false,
          familyIds: [family.id],
          personIds: [parent.person_id],
        });
      }
    }

    for (const child of children) {
      if (deletedPersonIds.has(child.person_id)) {
        issues.push({
          id: `family_child:${family.id}:${child.person_id}:deleted-person`,
          kind: "family_edge_points_to_deleted_person",
          severity: "error",
          title: familyModelKindLabels.family_edge_points_to_deleted_person,
          description: `family_children trong family ${family.id} trỏ tới person đã soft-delete: ${formatPerson(child.person_id, personById)}.`,
          repairable: false,
          familyIds: [family.id],
          personIds: [child.person_id],
        });
      }
    }
  }

  checkChildBiologicalConflicts({
    issues,
    familyParents,
    familyChildren,
    activeFamilyIds,
    activePersonIds,
    personById,
  });

  return buildResult(issues);
}

function checkMissingLegacySync(input: {
  issues: FamilyModelQualityIssue[];
  relationships: FamilyModelQualityRelationship[];
  activePersonIds: Set<string>;
  deletedPersonIds: Set<string>;
  familyParents: FamilyModelQualityFamilyParent[];
  familyChildren: FamilyModelQualityFamilyChild[];
  activeFamilyIds: Set<string>;
}) {
  const activeParents = input.familyParents.filter((row) => input.activeFamilyIds.has(row.family_id));
  const activeChildren = input.familyChildren.filter((row) => input.activeFamilyIds.has(row.family_id));

  for (const rel of input.relationships) {
    if (rel.deleted_at) continue;
    if (!rel.person_a || !rel.person_b) continue;

    const relId = rel.id ?? `${rel.type}:${rel.person_a}:${rel.person_b}`;

    if (input.deletedPersonIds.has(rel.person_a) || input.deletedPersonIds.has(rel.person_b)) {
      input.issues.push({
        id: `relationship:${relId}:deleted-person`,
        kind: "relationship_points_to_deleted_person",
        severity: "error",
        title: familyModelKindLabels.relationship_points_to_deleted_person,
        description: `Relationship ${relId} active nhưng trỏ tới person đã soft-delete.`,
        repairable: false,
        personIds: [rel.person_a, rel.person_b],
        relationshipIds: rel.id ? [rel.id] : undefined,
      });
      continue;
    }

    if (!input.activePersonIds.has(rel.person_a) || !input.activePersonIds.has(rel.person_b)) {
      continue;
    }

    if (rel.type === "marriage") {
      const hasFamily = activeParents.some((a) => {
        if (a.person_id !== rel.person_a) return false;
        return activeParents.some(
          (b) => b.family_id === a.family_id && b.person_id === rel.person_b,
        );
      });

      if (!hasFamily) {
        input.issues.push({
          id: `relationship:${relId}:missing-marriage-family`,
          kind: "missing_marriage_family",
          severity: "error",
          title: familyModelKindLabels.missing_marriage_family,
          description: `Marriage relationship ${rel.person_a} ↔ ${rel.person_b} chưa có family chứa cả hai parent.`,
          repairable: true,
          personIds: [rel.person_a, rel.person_b],
          relationshipIds: rel.id ? [rel.id] : undefined,
          repairHint: "Có thể repair bằng ensure_family_model_marriage(person_a, person_b).",
        });
      }
    }

    if (rel.type === "biological_child" || rel.type === "adopted_child") {
      const hasFamilyChild = activeChildren.some((child) => {
        if (child.person_id !== rel.person_b) return false;
        return activeParents.some(
          (parent) => parent.family_id === child.family_id && parent.person_id === rel.person_a,
        );
      });

      if (!hasFamilyChild) {
        input.issues.push({
          id: `relationship:${relId}:missing-child-family`,
          kind: "missing_child_family",
          severity: "error",
          title: familyModelKindLabels.missing_child_family,
          description: `${rel.type} relationship parent=${rel.person_a}, child=${rel.person_b} chưa có family_children tương ứng.`,
          repairable: true,
          personIds: [rel.person_a, rel.person_b],
          relationshipIds: rel.id ? [rel.id] : undefined,
          repairHint: "Có thể repair bằng ensure_family_model_child(parent, child, parent_b).",
        });
      }
    }
  }
}

function checkDuplicateFamilyRows(input: {
  issues: FamilyModelQualityIssue[];
  familyParents: FamilyModelQualityFamilyParent[];
  familyChildren: FamilyModelQualityFamilyChild[];
  activeFamilyIds: Set<string>;
}) {
  const parentGroups = groupBy(
    input.familyParents.filter((row) => input.activeFamilyIds.has(row.family_id)),
    (row) => `${row.family_id}:${row.person_id}`,
  );

  for (const [key, rows] of parentGroups.entries()) {
    if (rows.length <= 1) continue;
    const [familyId, personId] = key.split(":");
    input.issues.push({
      id: `family_parent:${familyId}:${personId}:duplicate`,
      kind: "duplicate_family_parent",
      severity: "error",
      title: familyModelKindLabels.duplicate_family_parent,
      description: `family_parents có ${rows.length} dòng trùng family=${familyId}, person=${personId}.`,
      repairable: true,
      familyIds: [familyId],
      personIds: [personId],
      details: { duplicateCount: rows.length },
      repairHint: "Giữ dòng đầu tiên, xóa các dòng trùng còn lại sau khi preview.",
    });
  }

  const childGroups = groupBy(
    input.familyChildren.filter((row) => input.activeFamilyIds.has(row.family_id)),
    (row) => `${row.family_id}:${row.person_id}:${row.relationship_type ?? "biological"}`,
  );

  for (const [key, rows] of childGroups.entries()) {
    if (rows.length <= 1) continue;
    const [familyId, personId, relationshipType] = key.split(":");
    input.issues.push({
      id: `family_child:${familyId}:${personId}:${relationshipType}:duplicate`,
      kind: "duplicate_family_child",
      severity: "error",
      title: familyModelKindLabels.duplicate_family_child,
      description: `family_children có ${rows.length} dòng trùng family=${familyId}, person=${personId}, type=${relationshipType}.`,
      repairable: true,
      familyIds: [familyId],
      personIds: [personId],
      details: { duplicateCount: rows.length, relationshipType },
      repairHint: "Giữ dòng đầu tiên, xóa các dòng trùng còn lại sau khi preview.",
    });
  }
}

function checkChildBiologicalConflicts(input: {
  issues: FamilyModelQualityIssue[];
  familyParents: FamilyModelQualityFamilyParent[];
  familyChildren: FamilyModelQualityFamilyChild[];
  activeFamilyIds: Set<string>;
  activePersonIds: Set<string>;
  personById: Map<string, FamilyModelQualityPerson>;
}) {
  const parentsByFamily = groupBy(
    input.familyParents.filter((row) => input.activeFamilyIds.has(row.family_id)),
    (row) => row.family_id,
  );
  const biologicalFamilyIdsByChild = new Map<string, Set<string>>();
  const biologicalParentsByChild = new Map<string, Set<string>>();

  for (const child of input.familyChildren) {
    if (!input.activeFamilyIds.has(child.family_id)) continue;
    if (!input.activePersonIds.has(child.person_id)) continue;

    const relationshipType = child.relationship_type ?? "biological";
    if (relationshipType !== "biological" && relationshipType !== "birth" && relationshipType !== "certain") {
      continue;
    }

    const familySet = biologicalFamilyIdsByChild.get(child.person_id) ?? new Set<string>();
    familySet.add(child.family_id);
    biologicalFamilyIdsByChild.set(child.person_id, familySet);

    const parentSet = biologicalParentsByChild.get(child.person_id) ?? new Set<string>();
    for (const parent of parentsByFamily.get(child.family_id) ?? []) {
      if (!input.activePersonIds.has(parent.person_id)) continue;
      parentSet.add(parent.person_id);
    }
    biologicalParentsByChild.set(child.person_id, parentSet);
  }

  for (const [childId, familyIds] of biologicalFamilyIdsByChild.entries()) {
    if (familyIds.size > 1) {
      input.issues.push({
        id: `family_child:${childId}:multiple-biological-families-advanced`,
        kind: "child_multiple_biological_families",
        severity: "warning",
        title: familyModelKindLabels.child_multiple_biological_families,
        description: `${formatPerson(childId, input.personById)} thuộc ${familyIds.size} biological family active.`,
        repairable: false,
        personIds: [childId],
        familyIds: Array.from(familyIds),
        repairHint: "Kiểm tra lại nếu do nhận con nuôi, tái hôn, hoặc family bị duplicate.",
      });
    }
  }

  for (const [childId, parentIds] of biologicalParentsByChild.entries()) {
    if (parentIds.size > 2) {
      input.issues.push({
        id: `family_child:${childId}:more-than-two-biological-parents`,
        kind: "child_more_than_two_biological_parents",
        severity: "warning",
        title: familyModelKindLabels.child_more_than_two_biological_parents,
        description: `${formatPerson(childId, input.personById)} có ${parentIds.size} biological parents trong Family Model.`,
        repairable: false,
        personIds: [childId, ...Array.from(parentIds)],
        repairHint: "Cần xác nhận role/relationship_type, không auto repair.",
      });
    }
  }
}

function buildResult(issues: FamilyModelQualityIssue[]): FamilyModelQualityResult {
  const groups = allKinds.reduce(
    (acc, kind) => {
      acc[kind] = [];
      return acc;
    },
    {} as Record<FamilyModelQualityKind, FamilyModelQualityIssue[]>,
  );

  for (const issue of issues) {
    groups[issue.kind].push(issue);
  }

  const byKind = allKinds.reduce(
    (acc, kind) => {
      acc[kind] = groups[kind].length;
      return acc;
    },
    {} as Record<FamilyModelQualityKind, number>,
  );

  return {
    summary: {
      total: issues.length,
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length,
      repairable: issues.filter((issue) => issue.repairable).length,
      byKind,
    },
    issues,
    groups,
  };
}

function formatPerson(
  personId: string,
  personById: Map<string, FamilyModelQualityPerson>,
): string {
  const person = personById.get(personId);
  return person?.full_name ? `${person.full_name} (${personId})` : personId;
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
