"use client";

import { Person, Relationship } from "@/types";
import { useCallback, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { usePanZoom } from "@/hooks/usePanZoom";
import { useMemberListView } from "@/context/MemberListContext";
import TreeToolbar from "@/components/TreeToolbar";
import {
  VIET_AVATAR_SIZE,
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

type FilterOptions = {
  hideDaughtersInLaw: boolean;
  hideSonsInLaw: boolean;
  hideDaughters: boolean;
  hideSons: boolean;
  hideMales: boolean;
  hideFemales: boolean;
};

const DEFAULT_AUTO_COLLAPSE_LEVEL = 4;

const NODE_WIDTH = VIET_NODE_WIDTH;
const NODE_HEIGHT = VIET_NODE_HEIGHT;
const AVATAR_SIZE = VIET_AVATAR_SIZE;
const SPOUSE_GAP = VIET_SPOUSE_GAP;
const SIBLING_GAP = VIET_SIBLING_GAP;
const GENERATION_GAP = VIET_GENERATION_GAP;
const CHILD_BAR_OFFSET = VIET_CHILD_BAR_OFFSET;

const LINE_COLOR = "#a8a29e";

export default function VietnameseFamilyTree({
  personsMap,
  relationships,
  roots,
  canEdit,
}: VietnameseFamilyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [manualExpandedIds, setManualExpandedIds] = useState<Set<string>>(
    new Set(),
  );
  const [manualCollapsedIds, setManualCollapsedIds] = useState<Set<string>>(
    new Set(),
  );

  const [hideDaughtersInLaw, setHideDaughtersInLaw] = useState(false);
  const [hideSonsInLaw, setHideSonsInLaw] = useState(false);
  const [hideDaughters, setHideDaughters] = useState(false);
  const [hideSons, setHideSons] = useState(false);
  const [hideMales, setHideMales] = useState(false);
  const [hideFemales, setHideFemales] = useState(false);
  const [hideExpandButtons, setHideExpandButtons] = useState(false);
  const [autoCollapseLevel, setAutoCollapseLevel] = useState(
    DEFAULT_AUTO_COLLAPSE_LEVEL,
  );

  const { showAvatar } = useMemberListView();

  const {
    scale,
    isPressed,
    handlers: {
      handleMouseDown,
      handleMouseMove,
      handleMouseUpOrLeave,
      handleClickCapture,
      handleZoomIn,
      handleZoomOut,
      handleResetZoom,
    },
  } = usePanZoom(containerRef);

  const filters: FilterOptions = {
    hideDaughtersInLaw,
    hideSonsInLaw,
    hideDaughters,
    hideSons,
    hideMales,
    hideFemales,
  };

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
      manualExpandedIds,
      manualCollapsedIds,
      autoCollapseLevel,
      filters,
      level: 0,
      visited: new Set(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roots,
    personsMap,
    relIndex,
    manualExpandedIds,
    manualCollapsedIds,
    autoCollapseLevel,
    hideDaughtersInLaw,
    hideSonsInLaw,
    hideDaughters,
    hideSons,
    hideMales,
    hideFemales,
  ]);

  const toggleExpanded = (personId: string, currentlyExpanded: boolean) => {
    setManualExpandedIds((prevExpanded) => {
      const nextExpanded = new Set(prevExpanded);

      setManualCollapsedIds((prevCollapsed) => {
        const nextCollapsed = new Set(prevCollapsed);

        if (currentlyExpanded) {
          nextExpanded.delete(personId);
          nextCollapsed.add(personId);
        } else {
          nextCollapsed.delete(personId);
          nextExpanded.add(personId);
        }

        return nextCollapsed;
      });

      return nextExpanded;
    });
  };

  const centerTree = useCallback(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const inner = el.querySelector("#export-container");

    if (inner) {
      const innerRect = inner.getBoundingClientRect();
      const containerRect = el.getBoundingClientRect();

      el.scrollLeft +=
        innerRect.left +
        innerRect.width / 2 -
        (containerRect.left + containerRect.width / 2);
    } else {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }
  }, []);

  if (!rootBlock) {
    return (
      <div className="p-10 text-center text-stone-500">
        Không tìm thấy dữ liệu.
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <TreeToolbar
        scale={scale}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        handleResetZoom={handleResetZoom}
        handleCenter={centerTree}
        hideExpandButtons={hideExpandButtons}
        setHideExpandButtons={setHideExpandButtons}
        autoCollapseLevel={autoCollapseLevel}
        setAutoCollapseLevel={setAutoCollapseLevel}
        hideDaughtersInLaw={hideDaughtersInLaw}
        setHideDaughtersInLaw={setHideDaughtersInLaw}
        hideSonsInLaw={hideSonsInLaw}
        setHideSonsInLaw={setHideSonsInLaw}
        hideDaughters={hideDaughters}
        setHideDaughters={setHideDaughters}
        hideSons={hideSons}
        setHideSons={setHideSons}
        hideMales={hideMales}
        setHideMales={setHideMales}
        hideFemales={hideFemales}
        setHideFemales={setHideFemales}
        canEdit={canEdit}
      />

      <div
        ref={containerRef}
        className={`w-full h-full overflow-auto bg-stone-50 ${
          isPressed ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onClickCapture={handleClickCapture}
        onDragStart={(e) => e.preventDefault()}
      >
        <div
          id="export-container"
          className="inline-block p-8"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="inline-block rounded-3xl border border-stone-200/80 bg-white p-8 shadow-sm">
            <svg
              width={rootBlock.width + 96}
              height={rootBlock.height + 96}
              className="rounded-2xl bg-linear-to-br from-stone-50 to-white"
            >
              <defs>
                <filter
                  id="viet-node-shadow"
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feDropShadow
                    dx="0"
                    dy="3"
                    stdDeviation="3"
                    floodColor="#000000"
                    floodOpacity="0.10"
                  />
                </filter>
              </defs>

              <g transform="translate(48, 48)">
                <RenderTreeBlock
                  block={rootBlock}
                  x={0}
                  y={0}
                  showAvatar={showAvatar}
                  hideExpandButtons={hideExpandButtons}
                  onToggleExpanded={toggleExpanded}
                />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function RenderTreeBlock({
  block,
  x,
  y,
  showAvatar,
  hideExpandButtons,
  onToggleExpanded,
}: {
  block: TreeBlock;
  x: number;
  y: number;
  showAvatar: boolean;
  hideExpandButtons: boolean;
  onToggleExpanded: (personId: string, currentlyExpanded: boolean) => void;
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
            showAvatar={showAvatar}
          />
        ))}

        {!hideExpandButtons && block.hasChildren ? (
          <g
            transform={`translate(${absoluteUnitCenterX - 12}, ${unitCenterY - 12})`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(block.person.id, block.expanded);
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
            {block.expanded ? (
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
              showAvatar={showAvatar}
              hideExpandButtons={hideExpandButtons}
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
  showAvatar,
}: {
  node: LayoutNode;
  x: number;
  y: number;
  showAvatar: boolean;
}) {
  const palette = getGenderPalette(node.person.gender);
  const dateParts = getPersonDateParts(node.person);
  const nameLines = splitNameIntoLines(node.person.full_name ?? "", showAvatar ? 13 : 18);
  const avatarHref = getAvatarHref(node.person);

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={18}
        fill="white"
        stroke={palette.stroke}
        strokeWidth={1.8}
        filter="url(#viet-node-shadow)"
      />

      <rect
        x={1}
        y={1}
        width={NODE_WIDTH - 2}
        height={NODE_HEIGHT - 2}
        rx={17}
        fill={palette.softFill}
        opacity={0.72}
      />

      {showAvatar ? (
        <Avatar person={node.person} palette={palette} href={avatarHref} />
      ) : null}

      <text
        x={NODE_WIDTH / 2}
        y={showAvatar ? 70 : nameLines.length > 1 ? 34 : 42}
        textAnchor="middle"
        fontSize={12.5}
        fontWeight={800}
        fill="#1c1917"
      >
        {nameLines.map((line, index) => (
          <tspan
            key={`${line}-${index}`}
            x={NODE_WIDTH / 2}
            dy={index === 0 ? 0 : 14}
          >
            {line}
          </tspan>
        ))}
      </text>

      {dateParts ? (
        <>
          <text
            x={NODE_WIDTH / 2}
            y={showAvatar ? 100 : 82}
            textAnchor="middle"
            fontSize={10.5}
            fill="#57534e"
          >
            {dateParts.prefix}
          </text>

          {dateParts.age ? (
            <text
              x={NODE_WIDTH / 2}
              y={showAvatar ? 116 : 98}
              textAnchor="middle"
              fontSize={10.5}
              fill="#57534e"
            >
              <tspan>(</tspan>
              <tspan fontWeight={900}>{dateParts.age}</tspan>
              <tspan> tuổi)</tspan>
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

function Avatar({
  person,
  palette,
  href,
}: {
  person: Person;
  palette: ReturnType<typeof getGenderPalette>;
  href: string;
}) {
  const avatarX = (NODE_WIDTH - AVATAR_SIZE) / 2;
  const avatarY = 10;
  const clipId = `avatar-clip-${person.id}`;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle
            cx={avatarX + AVATAR_SIZE / 2}
            cy={avatarY + AVATAR_SIZE / 2}
            r={AVATAR_SIZE / 2}
          />
        </clipPath>
      </defs>

      <circle
        cx={avatarX + AVATAR_SIZE / 2}
        cy={avatarY + AVATAR_SIZE / 2}
        r={AVATAR_SIZE / 2 + 3}
        fill="white"
        stroke={palette.stroke}
        strokeWidth={2}
      />

      <image
        href={href}
        x={avatarX}
        y={avatarY}
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="xMidYMid slice"
      />
    </g>
  );
}

function buildTreeBlock({
  person,
  personsMap,
  relIndex,
  manualExpandedIds,
  manualCollapsedIds,
  autoCollapseLevel,
  filters,
  level,
  visited,
}: {
  person: Person;
  personsMap: Map<string, Person>;
  relIndex: ReturnType<typeof buildRelationshipIndex>;
  manualExpandedIds: Set<string>;
  manualCollapsedIds: Set<string>;
  autoCollapseLevel: number;
  filters: FilterOptions;
  level: number;
  visited: Set<string>;
}): TreeBlock {
  const nextVisited = new Set(visited);
  nextVisited.add(person.id);

  const spouseIds = relIndex.spousesByPerson.get(person.id) ?? [];
  const spouses = spouseIds
    .filter((id) => !nextVisited.has(id))
    .map((id) => personsMap.get(id))
    .filter(Boolean)
    .filter((spouse) => shouldShowSpouse(spouse as Person, filters)) as Person[];

  const childIds = relIndex.childrenByParent.get(person.id) ?? [];
  const childPeople = sortVietnamesePeople(
    childIds
      .map((id) => personsMap.get(id))
      .filter(Boolean)
      .filter((child) => shouldShowChild(child as Person, filters)) as Person[],
  );

  const childBlocks = childPeople
    .filter((child) => !nextVisited.has(child.id))
    .map((child) =>
      buildTreeBlock({
        person: child,
        personsMap,
        relIndex,
        manualExpandedIds,
        manualCollapsedIds,
        autoCollapseLevel,
        filters,
        level: level + 1,
        visited: nextVisited,
      }),
    );

  const defaultExpanded =
    autoCollapseLevel > 0 &&
    level < autoCollapseLevel &&
    childBlocks.length > 0 &&
    !manualCollapsedIds.has(person.id);

  const expanded =
    childBlocks.length > 0 &&
    (manualExpandedIds.has(person.id) || defaultExpanded) &&
    !manualCollapsedIds.has(person.id);

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

function shouldShowChild(person: Person, filters: FilterOptions) {
  if (filters.hideMales && person.gender === "male") return false;
  if (filters.hideFemales && person.gender === "female") return false;
  if (filters.hideSons && person.gender === "male") return false;
  if (filters.hideDaughters && person.gender === "female") return false;
  return true;
}

function shouldShowSpouse(person: Person, filters: FilterOptions) {
  if (filters.hideMales && person.gender === "male") return false;
  if (filters.hideFemales && person.gender === "female") return false;
  if (filters.hideSonsInLaw && person.gender === "male") return false;
  if (filters.hideDaughtersInLaw && person.gender === "female") return false;
  return true;
}

function getGenderPalette(gender?: string | null) {
  if (gender === "male") {
    return {
      softFill: "#eff6ff",
      stroke: "#0ea5e9",
    };
  }

  if (gender === "female") {
    return {
      softFill: "#fff1f2",
      stroke: "#fb3f6c",
    };
  }

  return {
    softFill: "#fafaf9",
    stroke: "#a8a29e",
  };
}

function getAvatarHref(person: Person) {
  if (person.avatar_url) return person.avatar_url;

  if (person.gender === "female") {
    return "/avatar/v2/female.svg";
  }

  return "/avatar/v2/male.svg";
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

function splitNameIntoLines(name: string, maxChars: number) {
  const clean = name.trim();

  if (!clean) return [""];

  if (clean.length <= maxChars) return [clean];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }

    if (lines.length === 2) break;
  }

  if (lines.length < 2 && current) {
    lines.push(current);
  }

  if (lines.length === 2 && clean.length > lines.join(" ").length) {
    lines[1] = `${lines[1].slice(0, Math.max(1, maxChars - 1))}…`;
  }

  return lines.slice(0, 2);
}
