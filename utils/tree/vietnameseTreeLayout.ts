export type VietnameseTreePerson = {
  id: string;
  full_name: string;
  gender?: string | null;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  death_year?: number | null;
  death_month?: number | null;
  death_day?: number | null;
  is_deceased?: boolean | null;
  birth_order?: number | null;
  generation?: number | null;
  is_in_law?: boolean | null;
  avatar_url?: string | null;
};

export type VietnameseTreeParent = {
  person: VietnameseTreePerson;
  role: string;
};

export type VietnameseTreeFamily = {
  familyId: string;
  parents: VietnameseTreeParent[];
  children: VietnameseTreePerson[];
  expandedSpousesByChildId?: Map<string, VietnameseTreePerson[]>;
  childUnitWidthByChildId?: Map<string, number>;
};

export type VietnameseTreeLayoutNode = {
  id: string;
  person: VietnameseTreePerson;
  x: number;
  y: number;
  role: 'parent' | 'child' | 'child-spouse';
  familyId: string;
  anchorChildId?: string | null;
};

export type VietnameseTreeLayoutLine = {
  id: string;
  type: 'spouse' | 'center-down' | 'sibling-bar' | 'child-down';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type VietnameseTreeLayoutFamily = {
  familyId: string;
  nodes: VietnameseTreeLayoutNode[];
  lines: VietnameseTreeLayoutLine[];
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

/**
 * Compact node:
 * - block: 112 x 141
 * - avatar: 56 x 56
 * - text area visually fits 104px width
 */
export const VIET_NODE_WIDTH = 112;
export const VIET_NODE_HEIGHT = 141;
export const VIET_AVATAR_SIZE = 56;
export const VIET_SPOUSE_GAP = 28;
export const VIET_SIBLING_GAP = 34;
export const VIET_GENERATION_GAP = 86;
export const VIET_CHILD_BAR_OFFSET = 34;

const NODE_WIDTH = VIET_NODE_WIDTH;
const NODE_HEIGHT = VIET_NODE_HEIGHT;
const SPOUSE_GAP = VIET_SPOUSE_GAP;
const SIBLING_GAP = VIET_SIBLING_GAP;
const GENERATION_GAP = VIET_GENERATION_GAP;
const CHILD_BAR_OFFSET = VIET_CHILD_BAR_OFFSET;

/**
 * Helper layout một family block đơn giản.
 * VietnameseFamilyTree hiện dùng thuật toán recursive riêng,
 * nhưng function này vẫn giữ để route test và unit test không vỡ.
 */
export function buildVietnameseFamilyLayout(
  family: VietnameseTreeFamily,
): VietnameseTreeLayoutFamily {
  const sortedParents = sortParents(family.parents);
  const sortedChildren = sortChildren(family.children);

  const parentUnitWidth =
    sortedParents.length > 0
      ? sortedParents.length * NODE_WIDTH +
        Math.max(0, sortedParents.length - 1) * SPOUSE_GAP
      : 0;

  const childUnits = sortedChildren.map((child) => {
    const spouses = family.expandedSpousesByChildId?.get(child.id) ?? [];

    const naturalWidth =
      (1 + spouses.length) * NODE_WIDTH +
      Math.max(0, spouses.length) * SPOUSE_GAP;

    const requestedWidth = family.childUnitWidthByChildId?.get(child.id) ?? 0;

    return {
      child,
      spouses,
      naturalWidth,
      width: Math.max(naturalWidth, requestedWidth),
    };
  });

  const childrenWidth =
    childUnits.length > 0
      ? childUnits.reduce((sum, unit) => sum + unit.width, 0) +
        Math.max(0, childUnits.length - 1) * SIBLING_GAP
      : 0;

  const width = Math.max(parentUnitWidth, childrenWidth, NODE_WIDTH);
  const parentX = (width - parentUnitWidth) / 2;
  const childStartX = (width - childrenWidth) / 2;

  const parentY = 0;
  const childY =
    sortedParents.length > 0 ? NODE_HEIGHT + GENERATION_GAP : CHILD_BAR_OFFSET;
  const childBarY = childY - CHILD_BAR_OFFSET;

  const nodes: VietnameseTreeLayoutNode[] = [];
  const lines: VietnameseTreeLayoutLine[] = [];

  sortedParents.forEach((parent, index) => {
    nodes.push({
      id: `${family.familyId}:parent:${parent.person.id}`,
      person: parent.person,
      role: 'parent',
      familyId: family.familyId,
      x: parentX + index * (NODE_WIDTH + SPOUSE_GAP),
      y: parentY,
      anchorChildId: null,
    });
  });

  const parentCenters = nodes
    .filter((node) => node.role === 'parent')
    .map((node) => ({
      x: node.x + NODE_WIDTH / 2,
      y: node.y + NODE_HEIGHT / 2,
    }));

  const centerX =
    parentCenters.length > 0
      ? average(parentCenters.map((item) => item.x))
      : width / 2;

  const centerY =
    parentCenters.length > 0
      ? average(parentCenters.map((item) => item.y))
      : childBarY;

  if (parentCenters.length >= 2) {
    const left = parentCenters[0];
    const right = parentCenters[parentCenters.length - 1];

    lines.push({
      id: `${family.familyId}:spouse`,
      type: 'spouse',
      x1: left.x,
      y1: left.y,
      x2: right.x,
      y2: right.y,
    });
  }

  const childCenters: number[] = [];
  let cursorX = childStartX;

  for (const unit of childUnits) {
    const naturalX = cursorX + (unit.width - unit.naturalWidth) / 2;
    const childX = naturalX;
    const childCenterX = childX + NODE_WIDTH / 2;

    childCenters.push(childCenterX);

    nodes.push({
      id: `${family.familyId}:child:${unit.child.id}`,
      person: unit.child,
      role: 'child',
      familyId: family.familyId,
      x: childX,
      y: childY,
      anchorChildId: unit.child.id,
    });

    unit.spouses.forEach((spouse, spouseIndex) => {
      const spouseX = childX + (spouseIndex + 1) * (NODE_WIDTH + SPOUSE_GAP);

      nodes.push({
        id: `${family.familyId}:child-spouse:${unit.child.id}:${spouse.id}`,
        person: spouse,
        role: 'child-spouse',
        familyId: family.familyId,
        x: spouseX,
        y: childY,
        anchorChildId: unit.child.id,
      });

      lines.push({
        id: `${family.familyId}:child-spouse-line:${unit.child.id}:${spouse.id}`,
        type: 'spouse',
        x1: childX + NODE_WIDTH / 2,
        y1: childY + NODE_HEIGHT / 2,
        x2: spouseX + NODE_WIDTH / 2,
        y2: childY + NODE_HEIGHT / 2,
      });
    });

    cursorX += unit.width + SIBLING_GAP;
  }

  if (childCenters.length > 0) {
    const first = childCenters[0];
    const last = childCenters[childCenters.length - 1];

    if (parentCenters.length > 0) {
      lines.push({
        id: `${family.familyId}:center-down`,
        type: 'center-down',
        x1: centerX,
        y1: centerY,
        x2: centerX,
        y2: childBarY,
      });
    }

    lines.push({
      id: `${family.familyId}:sibling-bar`,
      type: 'sibling-bar',
      x1: Math.min(first, centerX),
      y1: childBarY,
      x2: Math.max(last, centerX),
      y2: childBarY,
    });

    for (const childCenterX of childCenters) {
      lines.push({
        id: `${family.familyId}:child-down:${childCenterX}`,
        type: 'child-down',
        x1: childCenterX,
        y1: childBarY,
        x2: childCenterX,
        y2: childY,
      });
    }
  }

  return {
    familyId: family.familyId,
    nodes,
    lines,
    centerX,
    centerY,
    width,
    height: childY + NODE_HEIGHT,
  };
}

export function sortVietnamesePeople<T extends VietnameseTreePerson>(people: T[]): T[] {
  return [...people].sort((a, b) => {
    const orderA = a.birth_order ?? Number.POSITIVE_INFINITY;
    const orderB = b.birth_order ?? Number.POSITIVE_INFINITY;

    if (orderA !== orderB) return orderA - orderB;

    const yearA = a.birth_year ?? Number.POSITIVE_INFINITY;
    const yearB = b.birth_year ?? Number.POSITIVE_INFINITY;

    if (yearA !== yearB) return yearA - yearB;

    return String(a.full_name ?? '').localeCompare(
      String(b.full_name ?? ''),
      'vi',
    );
  });
}

function sortParents(parents: VietnameseTreeParent[]) {
  return [...parents].sort((a, b) => {
    const roleA = roleRank(a.role);
    const roleB = roleRank(b.role);

    if (roleA !== roleB) return roleA - roleB;

    return String(a.person.full_name ?? '').localeCompare(
      String(b.person.full_name ?? ''),
      'vi',
    );
  });
}

function sortChildren(children: VietnameseTreePerson[]) {
  return sortVietnamesePeople(children);
}

function roleRank(role: string) {
  if (role === 'husband') return 1;
  if (role === 'wife') return 2;
  return 3;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
