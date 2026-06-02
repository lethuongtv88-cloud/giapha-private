"use client";

import { Person, Relationship } from "@/types";
import { useMemo } from "react";
import {
  buildVietnameseFamilyLayout,
  type VietnameseTreeFamily,
  type VietnameseTreeLayoutFamily,
  type VietnameseTreeLayoutNode,
} from "@/utils/tree/vietnameseTreeLayout";

type VietnameseFamilyTreeProps = {
  personsMap: Map<string, Person>;
  relationships: Relationship[];
  roots: Person[];
  canEdit?: boolean;
};

type FamilyBlock = {
  family: VietnameseTreeFamily;
  layout: VietnameseTreeLayoutFamily;
  children: Array<{
    childId: string;
    block: FamilyBlock | null;
  }>;
};

const BLOCK_GAP_Y = 90;
const CHILD_SUBTREE_GAP_X = 48;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;

export default function VietnameseFamilyTree({
  personsMap,
  relationships,
  roots,
}: VietnameseFamilyTreeProps) {
  const relIndex = useMemo(
    () => buildRelationshipIndex(relationships),
    [relationships],
  );

  const rootBlock = useMemo(() => {
    const root = roots[0];
    if (!root) return null;

    return buildFamilyBlock({
      root,
      personsMap,
      relIndex,
      visited: new Set(),
    });
  }, [personsMap, relIndex, roots]);

  if (!rootBlock) {
    return (
      <div className="p-10 text-center text-stone-500">
        Không tìm thấy dữ liệu cây.
      </div>
    );
  }

  const measured = measureBlock(rootBlock);

  return (
    <div className="w-full h-full overflow-auto bg-stone-50 p-8">
      <div className="inline-block rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <svg
          width={measured.width + 80}
          height={measured.height + 80}
          className="bg-stone-50"
        >
          <g transform="translate(40, 40)">
            <RenderFamilyBlock
              block={rootBlock}
              x={0}
              y={0}
              measuredWidth={measured.width}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

function RenderFamilyBlock({
  block,
  x,
  y,
  measuredWidth,
}: {
  block: FamilyBlock;
  x: number;
  y: number;
  measuredWidth: number;
}) {
  const layoutX = x + (measuredWidth - block.layout.width) / 2;

  const childSubtrees = block.children
    .map((item) => {
      if (!item.block) return null;
      const childNode = block.layout.nodes.find(
        (node) => node.role === "child" && node.person.id === item.childId,
      );
      if (!childNode) return null;

      const measured = measureBlock(item.block);

      return {
        childId: item.childId,
        childNode,
        block: item.block,
        measured,
      };
    })
    .filter(Boolean) as Array<{
    childId: string;
    childNode: VietnameseTreeLayoutNode;
    block: FamilyBlock;
    measured: { width: number; height: number };
  }>;

  let cursorX = x;
  const subtreePositions = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();

  for (const item of childSubtrees) {
    const childCenterX = layoutX + item.childNode.x + NODE_WIDTH / 2;
    const proposedX = childCenterX - item.measured.width / 2;
    const finalX = Math.max(cursorX, proposedX);

    subtreePositions.set(item.childId, {
      x: finalX,
      y: y + block.layout.height + BLOCK_GAP_Y,
      width: item.measured.width,
      height: item.measured.height,
    });

    cursorX = finalX + item.measured.width + CHILD_SUBTREE_GAP_X;
  }

  return (
    <>
      <g transform={`translate(${layoutX}, ${y})`}>
        {block.layout.lines.map((line) => (
          <line
            key={line.id}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#a8a29e"
            strokeWidth={2}
          />
        ))}

        {block.layout.nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            <rect
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx={14}
              fill="white"
              stroke={node.role === "parent" ? "#d97706" : "#78716c"}
            />

            <text
              x={NODE_WIDTH / 2}
              y={32}
              textAnchor="middle"
              fontSize={13}
              fontWeight={600}
              fill="#292524"
            >
              {node.person.full_name}
            </text>

            <text
              x={NODE_WIDTH / 2}
              y={52}
              textAnchor="middle"
              fontSize={11}
              fill="#78716c"
            >
              {node.role === "parent" ? "Cha/Mẹ" : "Con"}
              {node.person.birth_year ? ` · ${node.person.birth_year}` : ""}
            </text>
          </g>
        ))}
      </g>

      {childSubtrees.map((item) => {
        const pos = subtreePositions.get(item.childId);
        if (!pos) return null;

        const childBottomX = layoutX + item.childNode.x + NODE_WIDTH / 2;
        const childBottomY = y + item.childNode.y + NODE_HEIGHT;
        const subtreeTopX = pos.x + pos.width / 2;
        const subtreeTopY = pos.y;

        return (
          <g key={`subtree-${item.childId}`}>
            <line
              x1={childBottomX}
              y1={childBottomY}
              x2={childBottomX}
              y2={childBottomY + 34}
              stroke="#a8a29e"
              strokeWidth={2}
            />
            <line
              x1={childBottomX}
              y1={childBottomY + 34}
              x2={subtreeTopX}
              y2={childBottomY + 34}
              stroke="#a8a29e"
              strokeWidth={2}
            />
            <line
              x1={subtreeTopX}
              y1={childBottomY + 34}
              x2={subtreeTopX}
              y2={subtreeTopY}
              stroke="#a8a29e"
              strokeWidth={2}
            />

            <RenderFamilyBlock
              block={item.block}
              x={pos.x}
              y={pos.y}
              measuredWidth={pos.width}
            />
          </g>
        );
      })}
    </>
  );
}

function buildFamilyBlock({
  root,
  personsMap,
  relIndex,
  visited,
}: {
  root: Person;
  personsMap: Map<string, Person>;
  relIndex: ReturnType<typeof buildRelationshipIndex>;
  visited: Set<string>;
}): FamilyBlock | null {
  if (visited.has(root.id)) return null;

  const nextVisited = new Set(visited);
  nextVisited.add(root.id);

  const spouseIds = relIndex.spousesByPerson.get(root.id) ?? [];
  const childIds = relIndex.childrenByParent.get(root.id) ?? [];

  const spouses = spouseIds
    .map((id) => personsMap.get(id))
    .filter(Boolean) as Person[];

  const children = childIds
    .map((id) => personsMap.get(id))
    .filter(Boolean) as Person[];

  const family: VietnameseTreeFamily = {
    familyId: root.id,
    parents: [
      {
        role: root.gender === "female" ? "wife" : "husband",
        person: root,
      },
      ...spouses.map((spouse) => ({
        role: spouse.gender === "female" ? "wife" : "husband",
        person: spouse,
      })),
    ],
    children,
  };

  const layout = buildVietnameseFamilyLayout(family);

  return {
    family,
    layout,
    children: children.map((child) => ({
      childId: child.id,
      block: buildFamilyBlock({
        root: child,
        personsMap,
        relIndex,
        visited: nextVisited,
      }),
    })),
  };
}

function measureBlock(block: FamilyBlock): { width: number; height: number } {
  const childMeasurements = block.children
    .map((item) => (item.block ? measureBlock(item.block) : null))
    .filter(Boolean) as Array<{ width: number; height: number }>;

  if (childMeasurements.length === 0) {
    return {
      width: block.layout.width,
      height: block.layout.height,
    };
  }

  const childrenWidth =
    childMeasurements.reduce((sum, item) => sum + item.width, 0) +
    Math.max(0, childMeasurements.length - 1) * CHILD_SUBTREE_GAP_X;

  return {
    width: Math.max(block.layout.width, childrenWidth),
    height:
      block.layout.height +
      BLOCK_GAP_Y +
      Math.max(...childMeasurements.map((item) => item.height)),
  };
}

function buildRelationshipIndex(relationships: Relationship[]) {
  const spousesByPerson = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();

  for (const rel of relationships) {
    if (rel.type === "marriage") {
      if (!spousesByPerson.has(rel.person_a)) spousesByPerson.set(rel.person_a, []);
      if (!spousesByPerson.has(rel.person_b)) spousesByPerson.set(rel.person_b, []);

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
