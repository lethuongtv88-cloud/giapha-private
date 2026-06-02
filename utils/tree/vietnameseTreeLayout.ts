export type VietnameseTreePerson = {
  id: string;
  full_name: string;
  gender?: string | null;
  birth_year?: number | null;
  birth_order?: number | null;
  generation?: number | null;
  is_in_law?: boolean | null;
};

export type VietnameseTreeParent = {
  person: VietnameseTreePerson;
  role: string;
};

export type VietnameseTreeFamily = {
  familyId: string;
  parents: VietnameseTreeParent[];
  children: VietnameseTreePerson[];
};

export type VietnameseTreeLayoutNode = {
  id: string;
  person: VietnameseTreePerson;
  x: number;
  y: number;
  role: 'parent' | 'child';
  familyId: string;
};

export type VietnameseTreeLayoutLine = {
  id: string;
  type: 'spouse' | 'center-down' | 'child';
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

const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;
const PARENT_GAP = 40;
const CHILD_GAP = 28;
const GENERATION_GAP = 110;

export function buildVietnameseFamilyLayout(
  family: VietnameseTreeFamily,
): VietnameseTreeLayoutFamily {
  const sortedParents = sortParents(family.parents);
  const sortedChildren = sortChildren(family.children);

  const parentCount = Math.max(sortedParents.length, 1);
  const childrenCount = sortedChildren.length;

  const parentBlockWidth =
    parentCount * NODE_WIDTH + Math.max(0, parentCount - 1) * PARENT_GAP;

  const childBlockWidth =
    childrenCount > 0
      ? childrenCount * NODE_WIDTH + Math.max(0, childrenCount - 1) * CHILD_GAP
      : NODE_WIDTH;

  const width = Math.max(parentBlockWidth, childBlockWidth);
  const parentStartX = (width - parentBlockWidth) / 2;
  const childStartX = (width - childBlockWidth) / 2;

  const parentY = 0;
  const centerY = parentY + NODE_HEIGHT + 34;
  const childY = parentY + NODE_HEIGHT + GENERATION_GAP;

  const nodes: VietnameseTreeLayoutNode[] = [];
  const lines: VietnameseTreeLayoutLine[] = [];

  sortedParents.forEach((parent, index) => {
    nodes.push({
      id: `${family.familyId}:parent:${parent.person.id}`,
      person: parent.person,
      role: 'parent',
      familyId: family.familyId,
      x: parentStartX + index * (NODE_WIDTH + PARENT_GAP),
      y: parentY,
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
      ? average(parentCenters.map((p) => p.x))
      : width / 2;

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

    lines.push({
      id: `${family.familyId}:center-down`,
      type: 'center-down',
      x1: centerX,
      y1: left.y,
      x2: centerX,
      y2: centerY,
    });
  } else if (parentCenters.length === 1) {
    lines.push({
      id: `${family.familyId}:center-down`,
      type: 'center-down',
      x1: parentCenters[0].x,
      y1: parentCenters[0].y + NODE_HEIGHT / 2,
      x2: centerX,
      y2: centerY,
    });
  }

  sortedChildren.forEach((child, index) => {
    const childX = childStartX + index * (NODE_WIDTH + CHILD_GAP);
    const childTopY = childY;

    nodes.push({
      id: `${family.familyId}:child:${child.id}`,
      person: child,
      role: 'child',
      familyId: family.familyId,
      x: childX,
      y: childTopY,
    });

    lines.push({
      id: `${family.familyId}:child-line:${child.id}`,
      type: 'child',
      x1: centerX,
      y1: centerY,
      x2: childX + NODE_WIDTH / 2,
      y2: childTopY,
    });
  });

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

function sortParents(parents: VietnameseTreeParent[]) {
  return [...parents].sort((a, b) => {
    const roleA = roleRank(a.role);
    const roleB = roleRank(b.role);
    if (roleA !== roleB) return roleA - roleB;
    return String(a.person.full_name).localeCompare(String(b.person.full_name), 'vi');
  });
}

function sortChildren(children: VietnameseTreePerson[]) {
  return [...children].sort((a, b) => {
    const orderA = a.birth_order ?? Number.POSITIVE_INFINITY;
    const orderB = b.birth_order ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;

    const yearA = a.birth_year ?? Number.POSITIVE_INFINITY;
    const yearB = b.birth_year ?? Number.POSITIVE_INFINITY;
    if (yearA !== yearB) return yearA - yearB;

    return String(a.full_name).localeCompare(String(b.full_name), 'vi');
  });
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
