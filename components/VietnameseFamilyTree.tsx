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
  VIET_MARRIAGE_GROUP_GAP,
  VIET_NODE_HEIGHT,
  VIET_NODE_WIDTH,
  VIET_SIBLING_GAP,
  VIET_SPOUSE_GAP,
  sortVietnamesePeople,
} from "@/utils/tree/vietnameseTreeLayout";

type FamilyRow = {
  id: string;
  type?: string | null;
  status?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  note?: string | null;
  legacy_relationship_id?: string | null;
  version?: number | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FamilyParentRow = {
  id: string;
  family_id: string;
  person_id: string;
  role?: string | null;
  sort_order?: number | null;
};

type FamilyChildRow = {
  id: string;
  family_id: string;
  person_id: string;
  relationship_type?: string | null;
  sort_order?: number | null;
  legacy_relationship_id?: string | null;
  migration_confidence?: string | null;
};

type VietnameseFamilyTreeProps = {
  personsMap: Map<string, Person>;
  relationships: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
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

type FamilyGroup = {
  family: FamilyRow;
  groupId: string;
  parents: Person[];
  spouses: Person[];
  children: Person[];
  childBlocks: TreeBlock[];
  visibleChildren: ChildSlot[];
  hasChildren: boolean;
  expanded: boolean;
  x: number;
  width: number;
  anchorX: number;
  anchorRelX: number;
  orderX: number;
  childrenWidth: number;
};

type ChildSlot = {
  childId: string;
  block: TreeBlock;
  x: number;
  childTopCenterX: number;
};

type TreeBlock = {
  person: Person;
  unitPeople: Person[];
  groups: FamilyGroup[];
  hasChildren: boolean;
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
const MARRIAGE_GROUP_GAP = VIET_MARRIAGE_GROUP_GAP;
const GENERATION_GAP = VIET_GENERATION_GAP;
const CHILD_BAR_OFFSET = VIET_CHILD_BAR_OFFSET;

const LINE_COLOR = "#a8a29e";

export default function VietnameseFamilyTree({
  personsMap,
  relationships: _relationships,
  families = [],
  familyParents = [],
  familyChildren = [],
  roots,
  canEdit,
}: VietnameseFamilyTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

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

  const { showAvatar, setMemberModalId } = useMemberListView();

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

  const familyIndex = useMemo(
    () =>
      buildFamilyIndex({
        families,
        familyParents,
        familyChildren,
        personsMap,
      }),
    [families, familyParents, familyChildren, personsMap],
  );

  const rootBlock = useMemo(() => {
    const root = roots[0];
    if (!root) return null;

    return buildTreeBlock({
      person: root,
      familyIndex,
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
    familyIndex,
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

  const toggleGroupExpanded = (groupId: string, currentlyExpanded: boolean) => {
    setManualExpandedIds((prevExpanded) => {
      const nextExpanded = new Set(prevExpanded);

      setManualCollapsedIds((prevCollapsed) => {
        const nextCollapsed = new Set(prevCollapsed);

        if (currentlyExpanded) {
          nextExpanded.delete(groupId);
          nextCollapsed.add(groupId);
        } else {
          nextCollapsed.delete(groupId);
          nextExpanded.add(groupId);
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
                  x="-25%"
                  y="-25%"
                  width="150%"
                  height="150%"
                >
                  <feDropShadow
                    dx="0"
                    dy="3"
                    stdDeviation="3"
                    floodColor="#000000"
                    floodOpacity="0.10"
                  />
                </filter>

                <filter
                  id="viet-node-hover-shadow"
                  x="-35%"
                  y="-35%"
                  width="170%"
                  height="170%"
                >
                  <feDropShadow
                    dx="0"
                    dy="8"
                    stdDeviation="6"
                    floodColor="#000000"
                    floodOpacity="0.22"
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
                  hoveredNodeId={hoveredNodeId}
                  setHoveredNodeId={setHoveredNodeId}
                  onToggleGroupExpanded={toggleGroupExpanded}
                  onOpenPerson={setMemberModalId}
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
  hoveredNodeId,
  setHoveredNodeId,
  onToggleGroupExpanded,
  onOpenPerson,
}: {
  block: TreeBlock;
  x: number;
  y: number;
  showAvatar: boolean;
  hideExpandButtons: boolean;
  hoveredNodeId: string | null;
  setHoveredNodeId: (id: string | null) => void;
  onToggleGroupExpanded: (groupId: string, currentlyExpanded: boolean) => void;
  onOpenPerson: (personId: string | null) => void;
}) {
  const unitCenterY = y + NODE_HEIGHT / 2;
  const childTopY = y + NODE_HEIGHT + GENERATION_GAP;
  const childBarY = childTopY - CHILD_BAR_OFFSET;

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
            isHovered={hoveredNodeId === node.id}
            setHoveredNodeId={setHoveredNodeId}
            onOpenPerson={onOpenPerson}
          />
        ))}

        {!hideExpandButtons
          ? block.groups
              .filter((group) => group.hasChildren)
              .map((group) => (
                <g
                  key={`toggle-${group.groupId}`}
                  transform={`translate(${x + group.anchorX - 12}, ${
                    unitCenterY - 12
                  })`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleGroupExpanded(group.groupId, group.expanded);
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
                  {group.expanded ? (
                    <Minus x={6} y={6} width={12} height={12} color="#57534e" />
                  ) : (
                    <Plus x={6} y={6} width={12} height={12} color="#57534e" />
                  )}
                </g>
              ))
          : null}
      </g>

      {block.groups
        .filter((group) => group.expanded && group.visibleChildren.length > 0)
        .map((group) => {
          const childCenters = group.visibleChildren.map(
            (slot) => x + group.x + slot.x + slot.childTopCenterX,
          );

          const firstChildCenter = childCenters[0];
          const lastChildCenter = childCenters[childCenters.length - 1];
          const anchorX = x + group.anchorX;

          return (
            <g key={`group-children-${group.groupId}`}>
              <line
                x1={anchorX}
                y1={unitCenterY}
                x2={anchorX}
                y2={childBarY}
                stroke={LINE_COLOR}
                strokeWidth={2}
              />

              <line
                x1={Math.min(firstChildCenter, anchorX)}
                y1={childBarY}
                x2={Math.max(lastChildCenter, anchorX)}
                y2={childBarY}
                stroke={LINE_COLOR}
                strokeWidth={2}
              />

              {group.visibleChildren.map((slot) => {
                const childCenterX = x + group.x + slot.x + slot.childTopCenterX;

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

              {group.visibleChildren.map((slot) => (
                <RenderTreeBlock
                  key={slot.childId}
                  block={slot.block}
                  x={x + group.x + slot.x}
                  y={childTopY}
                  showAvatar={showAvatar}
                  hideExpandButtons={hideExpandButtons}
                  hoveredNodeId={hoveredNodeId}
                  setHoveredNodeId={setHoveredNodeId}
                  onToggleGroupExpanded={onToggleGroupExpanded}
                  onOpenPerson={onOpenPerson}
                />
              ))}
            </g>
          );
        })}
    </>
  );
}

function PersonNode({
  node,
  x,
  y,
  showAvatar,
  isHovered,
  setHoveredNodeId,
  onOpenPerson,
}: {
  node: LayoutNode;
  x: number;
  y: number;
  showAvatar: boolean;
  isHovered: boolean;
  setHoveredNodeId: (id: string | null) => void;
  onOpenPerson: (personId: string | null) => void;
}) {
  const palette = getGenderPalette(node.person.gender);
  const dateParts = getPersonDateParts(node.person);
  const nameLines = splitNameIntoLines(node.person.full_name ?? "", 11);
  const avatarHref = getAvatarHref(node.person);

  const scale = isHovered ? 1.055 : 1;
  const translateX = isHovered ? -(NODE_WIDTH * (scale - 1)) / 2 : 0;
  const translateY = isHovered ? -(NODE_HEIGHT * (scale - 1)) / 2 - 5 : 0;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={() => setHoveredNodeId(node.id)}
      onMouseLeave={() => setHoveredNodeId(null)}
      onClick={(event) => {
        event.stopPropagation();
        onOpenPerson(node.person.id);
      }}
      style={{ cursor: "pointer" }}
    >
      <g
        transform={`translate(${translateX}, ${translateY}) scale(${scale})`}
        style={{
          transition:
            "transform 160ms ease-out, filter 160ms ease-out, opacity 160ms ease-out",
        }}
      >
        <rect
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          rx={16}
          fill="white"
          stroke={isHovered ? palette.hoverStroke : palette.stroke}
          strokeWidth={isHovered ? 2.4 : 1.8}
          filter={
            isHovered
              ? "url(#viet-node-hover-shadow)"
              : "url(#viet-node-shadow)"
          }
        />

        <rect
          x={1}
          y={1}
          width={NODE_WIDTH - 2}
          height={NODE_HEIGHT - 2}
          rx={15}
          fill={palette.softFill}
          opacity={isHovered ? 0.95 : 0.72}
        />

        {showAvatar ? (
          <Avatar person={node.person} palette={palette} href={avatarHref} />
        ) : null}

        <text
          x={NODE_WIDTH / 2}
          y={
            showAvatar
              ? nameLines.length > 1
                ? 82
                : 90
              : nameLines.length > 1
                ? 40
                : 49
          }
          textAnchor="middle"
          fontSize={11.2}
          fontWeight={800}
          fill="#1c1917"
        >
          {nameLines.map((line, index) => (
            <tspan
              key={`${line}-${index}`}
              x={NODE_WIDTH / 2}
              dy={index === 0 ? 0 : 13}
            >
              {line}
            </tspan>
          ))}
        </text>

        {dateParts ? (
          <>
            <text
              x={NODE_WIDTH / 2}
              y={showAvatar ? 112 : 74}
              textAnchor="middle"
              fontSize={9.8}
              fill="#57534e"
            >
              {dateParts.prefix}
            </text>

            {dateParts.age ? (
              <text
                x={NODE_WIDTH / 2}
                y={showAvatar ? 128 : 92}
                textAnchor="middle"
                fontSize={9.8}
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
  const avatarY = 12;
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
  familyIndex,
  manualExpandedIds,
  manualCollapsedIds,
  autoCollapseLevel,
  filters,
  level,
  visited,
}: {
  person: Person;
  familyIndex: ReturnType<typeof buildFamilyIndex>;
  manualExpandedIds: Set<string>;
  manualCollapsedIds: Set<string>;
  autoCollapseLevel: number;
  filters: FilterOptions;
  level: number;
  visited: Set<string>;
}): TreeBlock {
  const nextVisited = new Set(visited);
  nextVisited.add(person.id);

  const parentFamilyIds = familyIndex.familyIdsByParentId.get(person.id) ?? [];

  const rawFamilies = parentFamilyIds
    .map((familyId) => familyIndex.familyById.get(familyId))
    .filter(Boolean)
    .map((family) => family!)
    .filter((family) => {
      const parents = familyIndex.parentsByFamilyId.get(family.id) ?? [];
      return parents.some((parent) => parent.person_id === person.id);
    })
    .sort((a, b) => compareFamilies(a, b, familyIndex));

  const groupDrafts = rawFamilies.map((family) => {
    const parentRows = familyIndex.parentsByFamilyId.get(family.id) ?? [];

    const parentPeople = parentRows
      .map((row) => familyIndex.personById.get(row.person_id))
      .filter(Boolean) as Person[];

    const spouses = parentPeople
      .filter((p) => p.id !== person.id)
      .filter((p) => shouldShowSpouse(p, filters));

    const childrenRows = familyIndex.childrenByFamilyId.get(family.id) ?? [];

    const children = sortChildrenByFamilyRows({
      rows: childrenRows,
      familyIndex,
      filters,
    }).filter((child) => !nextVisited.has(child.id));

    const childBlocks = children.map((child) =>
      buildTreeBlock({
        person: child,
        familyIndex,
        manualExpandedIds,
        manualCollapsedIds,
        autoCollapseLevel,
        filters,
        level: level + 1,
        visited: nextVisited,
      }),
    );

    const groupId = family.id;

    const defaultExpanded =
      autoCollapseLevel > 0 &&
      level < autoCollapseLevel &&
      childBlocks.length > 0 &&
      !manualCollapsedIds.has(groupId);

    const expanded =
      childBlocks.length > 0 &&
      (manualExpandedIds.has(groupId) || defaultExpanded) &&
      !manualCollapsedIds.has(groupId);

    const childrenWidth =
      expanded && childBlocks.length > 0
        ? childBlocks.reduce((sum, child) => sum + child.width, 0) +
          Math.max(0, childBlocks.length - 1) * SIBLING_GAP
        : 0;

    return {
      family,
      groupId,
      parentRows,
      parents: parentPeople,
      spouses,
      children,
      childBlocks,
      expanded,
      childrenWidth,
      groupWidth: Math.max(childrenWidth, NODE_WIDTH),
    };
  });

  /**
   * Nếu người này chưa có family làm cha/mẹ,
   * vẫn render node đơn.
   */
  if (groupDrafts.length === 0) {
    return buildSinglePersonBlock(person);
  }

  /**
   * BƯỚC 1:
   * Layout các family group/con TRƯỚC.
   * Mỗi group có một slot riêng, slot rộng theo số con/subtree.
   * Tâm slot chính là anchor của family đó.
   */
  const groupSlots = layoutFamilyGroupSlots(groupDrafts);

  /**
   * BƯỚC 2:
   * Từ anchor của từng group, đặt lại node vợ/chồng/cha/mẹ.
   * Không lấy trung điểm vợ-chồng nữa.
   */
  const positionedPeople = new Map<string, { person: Person; x: number }>();

  const personGender = person.gender;

/**
 * Khi bật filter ẩn dâu/rễ/nam/nữ, có những family chỉ còn lại
 * 1 parent hiển thị. Trường hợp đó không được neo theo khoảng giữa
 * vợ/chồng nữa, mà phải đặt parent còn hiển thị ngay giữa slot con.
 */
const visibleSpouseByGroupId = new Map<string, Person | null>();

for (const group of groupDrafts) {
  const visibleSpouses = group.spouses.filter((spouse) =>
    shouldShowSpouse(spouse, filters),
  );

  if (person.gender === "male") {
    visibleSpouseByGroupId.set(
      group.groupId,
      visibleSpouses.find((spouse) => spouse.gender === "female") ??
        visibleSpouses[0] ??
        null,
    );
  } else if (person.gender === "female") {
    visibleSpouseByGroupId.set(
      group.groupId,
      visibleSpouses.find((spouse) => spouse.gender === "male") ??
        visibleSpouses[0] ??
        null,
    );
  } else {
    visibleSpouseByGroupId.set(group.groupId, visibleSpouses[0] ?? null);
  }
}

if (personGender === "female") {
  /**
   * Đa phu:
   * - Nếu chồng/rễ còn hiển thị: chồng nằm trái, vợ nằm phải.
   * - Nếu chồng/rễ bị ẩn: vợ/mẹ nằm ngay giữa slot con.
   */
  const husbandGroups = groupDrafts.map((group, index) => ({
    group,
    slot: groupSlots[index],
    husband: visibleSpouseByGroupId.get(group.groupId),
  }));

  const groupsWithHusband = husbandGroups.filter((item) => item.husband);
  const groupsWithoutHusband = husbandGroups.filter((item) => !item.husband);

  for (const item of groupsWithHusband) {
    const husband = item.husband!;
    const husbandX = item.slot.anchorX - NODE_WIDTH - SPOUSE_GAP / 2;

    positionedPeople.set(husband.id, {
      person: husband,
      x: husbandX,
    });
  }

  if (groupsWithHusband.length > 0) {
    const rightMostHusbandRight = Math.max(
      ...groupsWithHusband.map((item) => {
        const husband = item.husband!;
        const pos = positionedPeople.get(husband.id);
        return (pos?.x ?? 0) + NODE_WIDTH;
      }),
    );

    positionedPeople.set(person.id, {
      person,
      x: rightMostHusbandRight + SPOUSE_GAP,
    });
  } else if (groupsWithoutHusband.length > 0) {
    const firstSlot = groupsWithoutHusband[0].slot;
    const lastSlot = groupsWithoutHusband[groupsWithoutHusband.length - 1].slot;
    const visibleCenter = (firstSlot.anchorX + lastSlot.anchorX) / 2;

    positionedPeople.set(person.id, {
      person,
      x: visibleCenter - NODE_WIDTH / 2,
    });
  }

  /**
   * Các spouse khác còn hiển thị nhưng không phải chồng được đặt sau người chính.
   */
  let extraX =
    (positionedPeople.get(person.id)?.x ?? 0) + NODE_WIDTH + SPOUSE_GAP;

  for (const group of groupDrafts) {
    for (const spouse of group.spouses) {
      if (spouse.gender === "male") continue;
      if (!shouldShowSpouse(spouse, filters)) continue;
      if (positionedPeople.has(spouse.id)) continue;

      positionedPeople.set(spouse.id, {
        person: spouse,
        x: extraX,
      });

      extraX += NODE_WIDTH + SPOUSE_GAP;
    }
  }
} else {
  /**
   * Mặc định / đa thê:
   * - Nếu vợ/dâu còn hiển thị: chồng bên trái, vợ bên phải.
   * - Nếu vợ/dâu bị ẩn: cha/chồng nằm ngay giữa slot con.
   */
  const wifeGroups = groupDrafts.map((group, index) => ({
    group,
    slot: groupSlots[index],
    wife: visibleSpouseByGroupId.get(group.groupId),
  }));

  const groupsWithWife = wifeGroups.filter((item) => item.wife);
  const groupsWithoutWife = wifeGroups.filter((item) => !item.wife);

  for (const item of groupsWithWife) {
    const wife = item.wife!;
    const wifeX = item.slot.anchorX + SPOUSE_GAP / 2;

    positionedPeople.set(wife.id, {
      person: wife,
      x: wifeX,
    });
  }

  if (groupsWithWife.length > 0) {
    const leftMostWifeLeft = Math.min(
      ...groupsWithWife.map((item) => {
        const wife = item.wife!;
        const pos = positionedPeople.get(wife.id);
        return pos?.x ?? 0;
      }),
    );

    positionedPeople.set(person.id, {
      person,
      x: leftMostWifeLeft - SPOUSE_GAP - NODE_WIDTH,
    });
  } else if (groupsWithoutWife.length > 0) {
    const firstSlot = groupsWithoutWife[0].slot;
    const lastSlot = groupsWithoutWife[groupsWithoutWife.length - 1].slot;
    const visibleCenter = (firstSlot.anchorX + lastSlot.anchorX) / 2;

    positionedPeople.set(person.id, {
      person,
      x: visibleCenter - NODE_WIDTH / 2,
    });
  }

  /**
   * Các spouse khác còn hiển thị nhưng không phải vợ được đặt sau các vợ.
   */
  let extraX =
    positionedPeople.size > 0
      ? Math.max(
          ...Array.from(positionedPeople.values()).map(
            (item) => item.x + NODE_WIDTH,
          ),
        ) + SPOUSE_GAP
      : NODE_WIDTH + SPOUSE_GAP;

  for (const group of groupDrafts) {
    for (const spouse of group.spouses) {
      if (spouse.gender === "female") continue;
      if (!shouldShowSpouse(spouse, filters)) continue;
      if (positionedPeople.has(spouse.id)) continue;

      positionedPeople.set(spouse.id, {
        person: spouse,
        x: extraX,
      });

      extraX += NODE_WIDTH + SPOUSE_GAP;
    }
  }
}
  /**
   * Nếu family chỉ có một cha/mẹ, chưa có spouse,
   * anchor chính là giữa node người đó.
   */
  if (!positionedPeople.has(person.id)) {
    const firstAnchor = groupSlots[0]?.anchorX ?? NODE_WIDTH / 2;

    positionedPeople.set(person.id, {
      person,
      x: firstAnchor - NODE_WIDTH / 2,
    });
  }

  /**
   * BƯỚC 3:
   * Normalize toàn bộ x để không âm.
   */
  const peoplePositions = Array.from(positionedPeople.values());

  const minPeopleX = Math.min(...peoplePositions.map((item) => item.x));
  const maxPeopleRight = Math.max(
    ...peoplePositions.map((item) => item.x + NODE_WIDTH),
  );

  const minGroupX = Math.min(...groupSlots.map((slot) => slot.x));
  const maxGroupRight = Math.max(
    ...groupSlots.map((slot) => slot.x + slot.width),
  );

  const minX = Math.min(minPeopleX, minGroupX, 0);
  const shiftX = minX < 0 ? -minX : 0;

  const width =
    Math.max(maxPeopleRight, maxGroupRight) + shiftX;

  const normalizedPeople = peoplePositions
    .map((item) => ({
      person: item.person,
      x: item.x + shiftX,
    }))
    .sort((a, b) => a.x - b.x);

  const personNode = normalizedPeople.find((item) => item.person.id === person.id);

  const nodeTopCenterX = personNode
    ? personNode.x + NODE_WIDTH / 2
    : NODE_WIDTH / 2;

  const unitX = Math.min(...normalizedPeople.map((item) => item.x));
  const unitRight = Math.max(
    ...normalizedPeople.map((item) => item.x + NODE_WIDTH),
  );
  const unitWidth = unitRight - unitX;
  const unitCenterX = unitX + unitWidth / 2;

  const nodes: LayoutNode[] = normalizedPeople.map((item) => ({
    id: `${person.id}:${item.person.id === person.id ? "main" : "spouse"}:${
      item.person.id
    }`,
    person: item.person,
    role: item.person.id === person.id ? "main" : "spouse",
    x: item.x,
    y: 0,
  }));

  const groups: FamilyGroup[] = groupDrafts.map((group, index) => {
  const slot = groupSlots[index];
  const groupX = slot.x + shiftX;

  const visibleSpouse = visibleSpouseByGroupId.get(group.groupId) ?? null;

  let anchorX = slot.anchorX + shiftX;

  /**
   * Nếu spouse của family này đang bị ẩn bởi filter,
   * đường con phải neo ngay giữa node người chính còn hiển thị.
   */
  if (!visibleSpouse) {
    const mainNode = positionedPeople.get(person.id);

    if (mainNode) {
      anchorX = mainNode.x + shiftX + NODE_WIDTH / 2;
    }
  }

    const visibleChildren: ChildSlot[] = [];

    if (group.expanded && group.childBlocks.length > 0) {
      const childStartX = (slot.width - group.childrenWidth) / 2;
      let childCursorX = childStartX;

      for (const childBlock of group.childBlocks) {
        visibleChildren.push({
          childId: childBlock.person.id,
          block: childBlock,
          x: childCursorX,
          childTopCenterX: childBlock.nodeTopCenterX,
        });

        childCursorX += childBlock.width + SIBLING_GAP;
      }
    }

    return {
      family: group.family,
      groupId: group.groupId,
      parents: group.parents,
      spouses: group.spouses,
      children: group.children,
      childBlocks: group.childBlocks,
      visibleChildren,
      hasChildren: group.childBlocks.length > 0,
      expanded: group.expanded,
      x: groupX,
      width: slot.width,
      anchorX,
      anchorRelX: anchorX,
      orderX: anchorX,
      childrenWidth: group.childrenWidth,
    };
  });

  const visibleGroupHeights = groups
    .filter((group) => group.expanded && group.visibleChildren.length > 0)
    .map((group) =>
      Math.max(...group.visibleChildren.map((slot) => slot.block.height)),
    );

  const height =
    NODE_HEIGHT +
    (visibleGroupHeights.length > 0
      ? GENERATION_GAP + Math.max(...visibleGroupHeights)
      : 0);

  return {
    person,
    unitPeople: normalizedPeople.map((item) => item.person),
    groups,
    hasChildren: groups.some((group) => group.hasChildren),
    width,
    height,
    unitWidth,
    unitX,
    unitCenterX,
    nodeTopCenterX,
    nodes,
  };
}
function buildSinglePersonBlock(person: Person): TreeBlock {
  return {
    person,
    unitPeople: [person],
    groups: [],
    hasChildren: false,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    unitWidth: NODE_WIDTH,
    unitX: 0,
    unitCenterX: NODE_WIDTH / 2,
    nodeTopCenterX: NODE_WIDTH / 2,
    nodes: [
      {
        id: `${person.id}:main:${person.id}`,
        person,
        role: "main",
        x: 0,
        y: 0,
      },
    ],
  };
}

function layoutFamilyGroupSlots(
  groups: Array<{
    groupId: string;
    childrenWidth: number;
    groupWidth: number;
    expanded: boolean;
  }>,
) {
  const slots: Array<{
    groupId: string;
    x: number;
    width: number;
    anchorX: number;
  }> = [];

  let cursorX = 0;

  for (const group of groups) {
    const width =
      group.expanded && group.childrenWidth > 0
        ? Math.max(group.childrenWidth, NODE_WIDTH)
        : NODE_WIDTH;

    const anchorX = cursorX + width / 2;

    slots.push({
      groupId: group.groupId,
      x: cursorX,
      width,
      anchorX,
    });

    cursorX += width + MARRIAGE_GROUP_GAP;
  }

  return slots;
}

function pickMaleSpouse(spouses: Person[]) {
  return sortVietnamesePeople(spouses).find(
    (spouse) => spouse.gender === "male",
  );
}

function pickFemaleSpouse(spouses: Person[]) {
  return sortVietnamesePeople(spouses).find(
    (spouse) => spouse.gender === "female",
  );
}
function buildFamilyIndex({
  families,
  familyParents,
  familyChildren,
  personsMap,
}: {
  families: FamilyRow[];
  familyParents: FamilyParentRow[];
  familyChildren: FamilyChildRow[];
  personsMap: Map<string, Person>;
}) {
  const familyById = new Map<string, FamilyRow>();
  const parentsByFamilyId = new Map<string, FamilyParentRow[]>();
  const childrenByFamilyId = new Map<string, FamilyChildRow[]>();
  const familyIdsByParentId = new Map<string, string[]>();
  const personById = personsMap;

  for (const family of families) {
    familyById.set(family.id, family);
  }

  for (const parent of familyParents) {
    if (!parentsByFamilyId.has(parent.family_id)) {
      parentsByFamilyId.set(parent.family_id, []);
    }

    parentsByFamilyId.get(parent.family_id)!.push(parent);

    if (!familyIdsByParentId.has(parent.person_id)) {
      familyIdsByParentId.set(parent.person_id, []);
    }

    familyIdsByParentId.get(parent.person_id)!.push(parent.family_id);
  }

  for (const child of familyChildren) {
    if (!childrenByFamilyId.has(child.family_id)) {
      childrenByFamilyId.set(child.family_id, []);
    }

    childrenByFamilyId.get(child.family_id)!.push(child);
  }

  for (const rows of parentsByFamilyId.values()) {
    rows.sort((a, b) => compareNullableNumber(a.sort_order, b.sort_order));
  }

  for (const rows of childrenByFamilyId.values()) {
    rows.sort((a, b) => compareNullableNumber(a.sort_order, b.sort_order));
  }

  for (const [personId, ids] of familyIdsByParentId.entries()) {
    ids.sort((a, b) => {
      const fa = familyById.get(a);
      const fb = familyById.get(b);
      if (!fa || !fb) return 0;
      return compareFamilies(fa, fb, {
        familyById,
        parentsByFamilyId,
        childrenByFamilyId,
        familyIdsByParentId,
        personById,
      });
    });

    familyIdsByParentId.set(personId, ids);
  }

  return {
    familyById,
    parentsByFamilyId,
    childrenByFamilyId,
    familyIdsByParentId,
    personById,
  };
}

function compareFamilies(
  a: FamilyRow,
  b: FamilyRow,
  familyIndex: {
    parentsByFamilyId: Map<string, FamilyParentRow[]>;
  },
) {
  const yearCompare = compareNullableNumber(a.start_year, b.start_year);
  if (yearCompare !== 0) return yearCompare;

  const aParents = familyIndex.parentsByFamilyId.get(a.id) ?? [];
  const bParents = familyIndex.parentsByFamilyId.get(b.id) ?? [];

  const parentOrderCompare = compareNullableNumber(
    minSortOrder(aParents),
    minSortOrder(bParents),
  );

  if (parentOrderCompare !== 0) return parentOrderCompare;

  return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
}

function minSortOrder(rows: Array<{ sort_order?: number | null }>) {
  const values = rows
    .map((row) => row.sort_order)
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) return null;

  return Math.min(...values);
}

function sortChildrenByFamilyRows({
  rows,
  familyIndex,
  filters,
}: {
  rows: FamilyChildRow[];
  familyIndex: ReturnType<typeof buildFamilyIndex>;
  filters: FilterOptions;
}) {
  const children = rows
    .map((row) => familyIndex.personById.get(row.person_id))
    .filter(Boolean)
    .filter((child) => shouldShowChild(child as Person, filters)) as Person[];

  return sortVietnamesePeople(children);
}

function pickSpouseForAnchor({
  person,
  spouses,
  centerRelXByPersonId,
}: {
  person: Person;
  spouses: Person[];
  centerRelXByPersonId: Map<string, number>;
}) {
  if (spouses.length === 0) return null;

  const preferred =
    person.gender === "male"
      ? spouses.find((spouse) => spouse.gender === "female")
      : spouses.find((spouse) => spouse.gender === "male");

  if (preferred) return preferred;

  return [...spouses].sort((a, b) => {
    const ax = centerRelXByPersonId.get(a.id) ?? 0;
    const bx = centerRelXByPersonId.get(b.id) ?? 0;
    return ax - bx;
  })[0];
}

function arrangeMarriageUnit(person: Person, spouses: Person[]) {
  const sortedSpouses = sortVietnamesePeople(spouses);

  if (person.gender === "female") {
    const husbands = sortedSpouses.filter((spouse) => spouse.gender === "male");
    const others = sortedSpouses.filter((spouse) => spouse.gender !== "male");

    return [...husbands, ...others, person];
  }

  const wives = sortedSpouses.filter((spouse) => spouse.gender === "female");
  const others = sortedSpouses.filter((spouse) => spouse.gender !== "female");

  return [person, ...wives, ...others];
}

function layoutVisibleGroups({
  unitWidth,
  groups,
}: {
  unitWidth: number;
  groups: Array<{
    groupId: string;
    groupWidth: number;
    anchorRelX: number;
    orderX: number;
  }>;
}) {
  if (groups.length === 0) {
    return {
      width: unitWidth,
      slots: [] as Array<{ groupId: string; x: number; width: number }>,
    };
  }

  const ordered = [...groups].sort((a, b) => a.orderX - b.orderX);

  let width = Math.max(
    unitWidth,
    ordered.reduce((sum, group) => sum + group.groupWidth, 0) +
      Math.max(0, ordered.length - 1) * MARRIAGE_GROUP_GAP,
  );

  let slots: Array<{ groupId: string; x: number; width: number }> = [];

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const unitX = (width - unitWidth) / 2;

    const rawSlots = ordered.map((group) => ({
      groupId: group.groupId,
      width: group.groupWidth,
      x: unitX + group.anchorRelX - group.groupWidth / 2,
    }));

    for (let i = 1; i < rawSlots.length; i += 1) {
      const prev = rawSlots[i - 1];
      const cur = rawSlots[i];

      cur.x = Math.max(cur.x, prev.x + prev.width + MARRIAGE_GROUP_GAP);
    }

    const minX = Math.min(...rawSlots.map((slot) => slot.x));

    if (minX < 0) {
      for (const slot of rawSlots) {
        slot.x -= minX;
      }
    }

    const maxRight = Math.max(...rawSlots.map((slot) => slot.x + slot.width));
    const nextWidth = Math.max(width, unitWidth, maxRight);

    slots = rawSlots;

    if (Math.abs(nextWidth - width) < 1) {
      width = nextWidth;
      break;
    }

    width = nextWidth;
  }

  return {
    width,
    slots,
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

function compareNullableNumber(a?: number | null, b?: number | null) {
  const aa = a ?? Number.POSITIVE_INFINITY;
  const bb = b ?? Number.POSITIVE_INFINITY;

  if (aa !== bb) return aa - bb;

  return 0;
}

function getGenderPalette(gender?: string | null) {
  if (gender === "male") {
    return {
      softFill: "#eff6ff",
      stroke: "#0ea5e9",
      hoverStroke: "#0284c7",
    };
  }

  if (gender === "female") {
    return {
      softFill: "#fff1f2",
      stroke: "#fb3f6c",
      hoverStroke: "#e11d48",
    };
  }

  return {
    softFill: "#fafaf9",
    stroke: "#a8a29e",
    hoverStroke: "#78716c",
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