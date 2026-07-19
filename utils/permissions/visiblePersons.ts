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
  /**
   * "Gốc chỉnh sửa" (rootedit) do admin gán riêng cho tài khoản (thường là editor),
   * độc lập với person_id của chính tài khoản đó. Khi có giá trị, tài khoản được
   * cấp thêm quyền xem/sửa: từ người gốc này trở xuống (con, cháu, ...), vợ/chồng
   * của những người đó, và toàn bộ gia đình bên vợ/chồng của chính người gốc.
   */
  editRootPersonId?: string | null;
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
  | "direct_spouse_lineage_spouse"
  | "edit_root"
  | "edit_root_spouse"
  | "edit_root_spouse_family"
  | "edit_root_spouse_family_spouse";

export type VisiblePersonsResult = {
  visiblePersonIds: Set<string>;
  /**
   * Phạm vi được phép THAY ĐỔI dữ liệu (thêm/sửa/xoá) - hẹp hơn hoặc bằng
   * visiblePersonIds. Khi tài khoản được admin gán editRootPersonId (rootedit),
   * phạm vi sửa CHỈ giới hạn trong nhánh rootedit (gốc trở xuống + gia đình bên
   * vợ/chồng của gốc) - KHÔNG bao gồm toàn bộ nhánh cá nhân (nội ngoại) mà tài
   * khoản đó có thể tự nhiên NHÌN THẤY qua person_id của chính họ. Nếu không có
   * editRootPersonId, phạm vi sửa mặc định bằng phạm vi xem (hành vi cũ).
   */
  editablePersonIds: Set<string>;
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

/**
 * Trả về chính người `rootId` và toàn bộ hậu duệ (con, cháu, chắt, ...) của
 * người đó — KHÔNG bao gồm tổ tiên hay anh chị em cùng hàng. Dùng cho phạm vi
 * "rootedit": chỉnh sửa từ gốc trở xuống.
 */
function buildDescendantScope(rootId: string, graphs: ReturnType<typeof buildGraphs>) {
  return collectReachable(rootId, graphs.parentToChildren);
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

function applyEditRootScope(
  editRootPersonId: string,
  visiblePersonIds: Set<string>,
  reasonByPersonId: Map<string, VisibleReason>,
  warnings: string[],
  graphs: ReturnType<typeof buildGraphs>,
  includeSpouses: boolean,
  includeDirectSpouseLineage: boolean,
) {
  if (!graphs.activePersonIds.has(editRootPersonId)) {
    warnings.push(
      "Gốc chỉnh sửa (rootedit) được admin gán không tồn tại hoặc đã bị xoá.",
    );
    return;
  }

  // 1. Người gốc + toàn bộ hậu duệ ("từ gốc đó trở xuống").
  const rootDescendants = buildDescendantScope(editRootPersonId, graphs);
  for (const personId of rootDescendants) {
    addReason(visiblePersonIds, reasonByPersonId, personId, "edit_root");
  }

  // 2. Vợ/chồng của người gốc và của từng hậu duệ (để có thể thêm/sửa dâu, rể).
  if (includeSpouses) {
    for (const personId of rootDescendants) {
      for (const spouseId of graphs.spouseGraph.get(personId) ?? []) {
        addReason(visiblePersonIds, reasonByPersonId, spouseId, "edit_root_spouse");
      }
    }
  }

  // 3. Toàn bộ gia đình bên vợ/chồng của riêng người gốc (không áp dụng cho
  // vợ/chồng của các hậu duệ khác), ví dụ: gia đình bên chồng của Chế 2.
  if (includeDirectSpouseLineage) {
    for (const spouseId of graphs.spouseGraph.get(editRootPersonId) ?? []) {
      addReason(visiblePersonIds, reasonByPersonId, spouseId, "edit_root_spouse");
      const spouseFamilyLineage = buildLineageScope(spouseId, graphs);
      addLineageWithSpouses(
        spouseFamilyLineage,
        visiblePersonIds,
        reasonByPersonId,
        graphs.spouseGraph,
        "edit_root_spouse_family",
        "edit_root_spouse_family_spouse",
        includeSpouses,
      );
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
    return {
      visiblePersonIds,
      editablePersonIds: new Set(visiblePersonIds),
      reasonByPersonId,
      warnings,
    };
  }

  const viewerPersonId = input.viewerPersonId;
  const editRootPersonId = input.editRootPersonId || null;
  const includeSpouses = input.options?.includeSpousesOfLineage ?? true;
  const includeDirectSpouseLineage = input.options?.includeDirectSpouseLineage ?? true;

  // Phạm vi rootedit được tính RIÊNG (set/map độc lập) để nó vừa có thể được
  // gộp vào visiblePersonIds (phục vụ xem/điều hướng), vừa được dùng NGUYÊN
  // VẸN làm editablePersonIds - không lẫn với phạm vi cá nhân (nội ngoại của
  // chính tài khoản), vốn chỉ nên cấp quyền XEM chứ không cấp quyền SỬA.
  const editRootScope = new Set<string>();
  const editRootReasonByPersonId = new Map<string, VisibleReason>();

  if (!viewerPersonId) {
    // Không có person_id cá nhân, nhưng vẫn có thể được cấp quyền qua rootedit.
    if (editRootPersonId) {
      applyEditRootScope(
        editRootPersonId,
        editRootScope,
        editRootReasonByPersonId,
        warnings,
        graphs,
        includeSpouses,
        includeDirectSpouseLineage,
      );
      for (const [personId, reason] of editRootReasonByPersonId) {
        addReason(visiblePersonIds, reasonByPersonId, personId, reason);
      }
      return {
        visiblePersonIds,
        editablePersonIds: editRootScope,
        reasonByPersonId,
        warnings,
      };
    }

    warnings.push("Tài khoản chưa được gắn với người trong gia phả.");
    return {
      visiblePersonIds,
      editablePersonIds: new Set(),
      reasonByPersonId,
      warnings,
    };
  }

  if (!graphs.activePersonIds.has(viewerPersonId)) {
    warnings.push("Người được gắn với tài khoản không tồn tại hoặc đã bị xoá.");
    return {
      visiblePersonIds,
      editablePersonIds: new Set(),
      reasonByPersonId,
      warnings,
    };
  }

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

  let editablePersonIds: Set<string>;

  if (editRootPersonId) {
    applyEditRootScope(
      editRootPersonId,
      editRootScope,
      editRootReasonByPersonId,
      warnings,
      graphs,
      includeSpouses,
      includeDirectSpouseLineage,
    );
    // Gộp vào visiblePersonIds để tài khoản có thể ĐIỀU HƯỚNG/XEM nhánh
    // rootedit (kể cả khi nhánh đó nằm ngoài phạm vi cá nhân của họ).
    for (const [personId, reason] of editRootReasonByPersonId) {
      addReason(visiblePersonIds, reasonByPersonId, personId, reason);
    }
    // Nhưng phạm vi được phép SỬA chỉ giới hạn đúng trong nhánh rootedit này -
    // KHÔNG cộng thêm phạm vi cá nhân (nội ngoại của chính tài khoản).
    editablePersonIds = editRootScope;
  } else {
    // Chưa được admin gán rootedit -> giữ hành vi cũ: được sửa bất cứ ai
    // nằm trong phạm vi xem của chính tài khoản (nội ngoại + bên vợ/chồng).
    editablePersonIds = new Set(visiblePersonIds);
  }

  return { visiblePersonIds, editablePersonIds, reasonByPersonId, warnings };
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
