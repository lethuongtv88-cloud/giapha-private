"use client";

import { Person, Relationship } from "@/types";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  VIET_CHILD_BAR_OFFSET,
  VIET_GENERATION_GAP,
  VIET_NODE_HEIGHT,
  VIET_NODE_WIDTH,
  VIET_SIBLING_GAP,
  VIET_SPOUSE_GAP,
  sortVietnamesePeople,
} from "@/utils/tree/vietnameseTreeLayout";

type VietnameseFamilyTreeProps = {
  personsMap: Map<string, Person>;
  relationships: Relationship[];
  roots: Person[];
  canEdit?: boolean;
};

type LayoutNode = {
  id: string;
  person: Person;
  x: number;
  y: number;
  role: "main" | "spouse";
};

type ChildSlot = {
  childId: string;
  block: TreeBlock;
  x: number;
  childTopCenterX: number;
};

type TreeBlock = {
  person: Person;
  spouses: Person[];
  children: TreeBlock[];
  visibleChildren: ChildSlot[];
  hasChildren: boolean;
  expanded: boolean;
  width: number;
  height: number;
  unitWidth: number;
  unitX: number;
  unitCenterX: number;
  nodeTopCenterX: number;
  nodes: LayoutNode[];
};

const NODE_WIDTH = VIET_NODE_WIDTH;
const NODE_HEIGHT = VIET_NODE_HEIGHT;
const SPOUSE_GAP = VIET_SPOUSE_GAP;
const SIBLING_GAP = VIET_SIBLING_GAP;
const GENERATION_GAP = VIET_GENERATION_GAP;
const CHILD_BAR_OFFSET = VIET_CHILD_BAR_OFFSET;

const LINE_COLOR = "#a8a29e";

export default function VietnameseFamilyTree({
  personsMap,
  relationships,
  roots,
}: VietnameseFamilyTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const relIndex = useMemo(
    () => buildRelationshipIndex(relationships),
    [relationships],
  );

  const rootBlock = useMemo(() => {
    const root = roots[0];
    if (!root) return null;

    return buildTreeBlock({
      person: root,
      personsMap,
      relIndex,
      expandedIds,
      visited: new Set(),
    });
  }, [roots, personsMap, relIndex, expandedIds]);

  const toggleExpanded = (personId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);

      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }

      return next;
    });
  };

  if (!rootBlock) {
    return (
      <div className="p-10 text-center text-stone-500">
        Không tìm thấy dữ liệu cây.
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto bg-stone-50 p-8">
      <div className="inline-block rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <svg
          width={rootBlock.width + 96}
          height={rootBlock.height + 96}
          className="bg-linear-to-br from-stone-50 to-white rounded-2xl"
        >
          <g transform="translate(48, 48)">
            <RenderTreeBlock
              block={rootBlock}
              x={0}
              y={0}
              expandedIds={expandedIds}
              onToggleExpanded={toggleExpanded}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

function RenderTreeBlock({
  block,
  x,
  y,
  expandedIds,
  onToggleExpanded,
}: {
  block: TreeBlock;
  x: number;
  y: number;
  expandedIds: Set<string>;
  onToggleExpanded: (personId: string) => void;
}) {
  const absoluteUnitCenterX = x + block.unitCenterX;
  const unitCenterY = y + NODE_HEIGHT / 2;

  const childTopY = y + NODE_HEIGHT + GENERATION_GAP;
  const childBarY = childTopY - CHILD_BAR_OFFSET;

  const childCenters = block.visibleChildren.map(
    (slot) => x + slot.x + slot.childTopCenterX,
  );

  const firstChildCenter = childCenters[0];
  const lastChildCenter = childCenters[childCenters.length - 1];

  return (
    <>
      <g>
        {block.nodes.length > 1 ? (
          <line
            x1={x + block.nodes[0].x + NODE_WIDTH / 2}
            y1={unitCenterY}
            x2={x + block.nodes[block.nodes.length - 1].x + NODE_WIDTH / 2}
            y2={unitCenterY}
            stroke={LINE_COLOR}
            strokeWidth={2}
          />
        ) : null}

        {block.nodes.map((node) => (
          <PersonNode
            key={node.id}
            node={node}
            x={x + node.x}
            y={y + node.y}
          />
        ))}

        {block.hasChildren ? (
          <g
            transform={`translate(${absoluteUnitCenterX - 12}, ${unitCenterY - 12})`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(block.person.id);
            }}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={12}
              cy={12}
              r={12}
              fill="white"
              stroke="#d6d3d1"
              strokeWidth={1.5}
            />
            {expandedIds.has(block.person.id) ? (
              <Minus x={6} y={6} width={12} height={12} color="#57534e" />
            ) : (
              <Plus x={6} y={6} width={12} height={12} color="#57534e" />
            )}
          </g>
        ) : null}
      </g>

      {block.expanded && block.visibleChildren.length > 0 ? (
        <g>
          <line
            x1={absoluteUnitCenterX}
            y1={unitCenterY}
            x2={absoluteUnitCenterX}
            y2={childBarY}
            stroke={LINE_COLOR}
            strokeWidth={2}
          />

          <line
            x1={Math.min(firstChildCenter, absoluteUnitCenterX)}
            y1={childBarY}
            x2={Math.max(lastChildCenter, absoluteUnitCenterX)}
            y2={childBarY}
            stroke={LINE_COLOR}
            strokeWidth={2}
          />

          {block.visibleChildren.map((slot) => {
            const childCenterX = x + slot.x + slot.childTopCenterX;

            return (
              <line
                key={`child-line-${slot.childId}`}
                x1={childCenterX}
                y1={childBarY}
                x2={childCenterX}
                y2={childTopY}
                stroke={LINE_COLOR}
                strokeWidth={2}
              />
            );
          })}

          {block.visibleChildren.map((slot) => (
            <RenderTreeBlock
              key={slot.childId}
              block={slot.block}
              x={x + slot.x}
              y={childTopY}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </g>
      ) : null}
    </>
  );
}

function PersonNode({
  node,
  x,
  y,
}: {
  node: LayoutNode;
  x: number;
  y: number;
}) {
  const palette = getGenderPalette(node.person.gender);
  const dateParts = getPersonDateParts(node.person);

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={16}
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth={1.8}
        filter="url(#none)"
      />

      <text
        x={NODE_WIDTH / 2}
        y={31}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill="#1c1917"
      >
        {truncateText(node.person.full_name ?? "", 22)}
      </text>

      {dateParts ? (
        <text
          x={NODE_WIDTH / 2}
          y={53}
          textAnchor="middle"
          fontSize={11}
          fill="#57534e"
        >
          <tspan>{dateParts.prefix}</tspan>
          {dateParts.age ? (
            <>
              <tspan> (</tspan>
              <tspan fontWeight={800}>{dateParts.age}</tspan>
              <tspan> tuổi)</tspan>
            </>
          ) : null}
        </text>
      ) : null}
    </g>
  );
}

function buildTreeBlock({
  person,
  personsMap,
  relIndex,
  expandedIds,
  visited,
}: {
  person: Person;
  personsMap: Map<string, Person>;
  relIndex: ReturnType<typeof buildRelationshipIndex>;
  expandedIds: Set<string>;
  visited: Set<string>;
}): TreeBlock {
  const nextVisited = new Set(visited);
  nextVisited.add(person.id);

  const spouseIds = relIndex.spousesByPerson.get(person.id) ?? [];
  const spouses = spouseIds
    .filter((id) => !nextVisited.has(id))
    .map((id) => personsMap.get(id))
    .filter(Boolean) as Person[];

  const childIds = relIndex.childrenByParent.get(person.id) ?? [];
  const childPeople = sortVietnamesePeople(
    childIds
      .map((id) => personsMap.get(id))
      .filter(Boolean) as Person[],
  );

  const childBlocks = childPeople
    .filter((child) => !nextVisited.has(child.id))
    .map((child) =>
      buildTreeBlock({
        person: child,
        personsMap,
        relIndex,
        expandedIds,
        visited: nextVisited,
      }),
    );

  const expanded = expandedIds.has(person.id);
  const hasChildren = childBlocks.length > 0;

  const unitPeople = [person, ...spouses];
  const unitWidth =
    unitPeople.length * NODE_WIDTH +
    Math.max(0, unitPeople.length - 1) * SPOUSE_GAP;

  const childrenWidth =
    expanded && childBlocks.length > 0
      ? childBlocks.reduce((sum, child) => sum + child.width, 0) +
        Math.max(0, childBlocks.length - 1) * SIBLING_GAP
      : 0;

  const width = Math.max(unitWidth, childrenWidth, NODE_WIDTH);
  const unitX = (width - unitWidth) / 2;
  const unitCenterX = unitX + unitWidth / 2;
  const nodeTopCenterX = unitX + NODE_WIDTH / 2;

  const nodes: LayoutNode[] = unitPeople.map((item, index) => ({
    id: `${person.id}:${index === 0 ? "main" : "spouse"}:${item.id}`,
    person: item,
    role: index === 0 ? "main" : "spouse",
    x: unitX + index * (NODE_WIDTH + SPOUSE_GAP),
    y: 0,
  }));

  const visibleChildren: ChildSlot[] = [];

  if (expanded && childBlocks.length > 0) {
    const childStartX = (width - childrenWidth) / 2;
    let cursorX = childStartX;

    for (const childBlock of childBlocks) {
      visibleChildren.push({
        childId: childBlock.person.id,
        block: childBlock,
        x: cursorX,
        childTopCenterX: childBlock.nodeTopCenterX,
      });

      cursorX += childBlock.width + SIBLING_GAP;
    }
  }

  const childHeight =
    visibleChildren.length > 0
      ? Math.max(...visibleChildren.map((slot) => slot.block.height))
      : 0;

  const height =
    NODE_HEIGHT +
    (visibleChildren.length > 0 ? GENERATION_GAP + childHeight : 0);

  return {
    person,
    spouses,
    children: childBlocks,
    visibleChildren,
    hasChildren,
    expanded,
    width,
    height,
    unitWidth,
    unitX,
    unitCenterX,
    nodeTopCenterX,
    nodes,
  };
}

function buildRelationshipIndex(relationships: Relationship[]) {
  const spousesByPerson = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();

  for (const rel of relationships) {
    if (rel.type === "marriage") {
      if (!spousesByPerson.has(rel.person_a)) {
        spousesByPerson.set(rel.person_a, []);
      }

      if (!spousesByPerson.has(rel.person_b)) {
        spousesByPerson.set(rel.person_b, []);
      }

      spousesByPerson.get(rel.person_a)!.push(rel.person_b);
      spousesByPerson.get(rel.person_b)!.push(rel.person_a);
    }

    if (rel.type === "biological_child" || rel.type === "adopted_child") {
      if (!childrenByParent.has(rel.person_a)) {
        childrenByParent.set(rel.person_a, []);
      }

      childrenByParent.get(rel.person_a)!.push(rel.person_b);
    }
  }

  return {
    spousesByPerson,
    childrenByParent,
  };
}

function getGenderPalette(gender?: string | null) {
  if (gender === "male") {
    return {
      fill: "#eff6ff",
      stroke: "#60a5fa",
    };
  }

  if (gender === "female") {
    return {
      fill: "#fff1f2",
      stroke: "#fb7185",
    };
  }

  return {
    fill: "#fafaf9",
    stroke: "#a8a29e",
  };
}

function getPersonDateParts(person: Person): { prefix: string; age: number | null } | null {
  const birthYear = person.birth_year ?? null;
  const birthMonth = person.birth_month ?? null;
  const birthDay = person.birth_day ?? null;

  if (!birthYear) return null;

  if (person.is_deceased && person.death_year) {
    const age = calculateDeathAge(person);
    return {
      prefix: `${birthYear} - ${person.death_year}`,
      age,
    };
  }

  const age = calculateLivingAge(person);
  return {
    prefix: formatBirthDate(birthYear, birthMonth, birthDay),
    age,
  };
}

function formatBirthDate(
  year: number,
  month?: number | null,
  day?: number | null,
) {
  if (day && month) {
    return `${pad2(day)}-${pad2(month)}-${year}`;
  }

  if (month) {
    return `${pad2(month)}-${year}`;
  }

  return String(year);
}

function calculateLivingAge(person: Person) {
  if (!person.birth_year) return null;

  const now = new Date();
  let age = now.getFullYear() - person.birth_year;

  if (person.birth_month) {
    const currentMonth = now.getMonth() + 1;

    if (
      currentMonth < person.birth_month ||
      (currentMonth === person.birth_month &&
        person.birth_day &&
        now.getDate() < person.birth_day)
    ) {
      age -= 1;
    }
  }

  return Math.max(age, 0);
}

function calculateDeathAge(person: Person) {
  if (!person.birth_year || !person.death_year) return null;

  let age = person.death_year - person.birth_year;

  if (person.birth_month && person.death_month) {
    if (
      person.death_month < person.birth_month ||
      (person.death_month === person.birth_month &&
        person.birth_day &&
        person.death_day &&
        person.death_day < person.birth_day)
    ) {
      age -= 1;
    }
  }

  return Math.max(age, 0);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function truncateText(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
