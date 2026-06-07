"use client";

import { Person, Relationship } from "@/types";
import { useCallback, useMemo, useRef, useState } from "react";
import { Activity, Check, Clipboard, Minus, Plus } from "lucide-react";
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
  childAnchorX: number;
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

type GroupDraft = {
  family: FamilyRow;
  groupId: string;
  parents: Person[];
  spouses: Person[];
  children: Person[];
  childBlocks: TreeBlock[];
  expanded: boolean;
  childLayout: BiologicalChildLayout;
  childrenWidth: number;
  groupWidth: number;
};

type BiologicalChildLayout = {
  width: number;
  anchorOffset: number;
  childXs: number[];
};

type GroupSlot = {
  groupId: string;
  x: number;
  width: number;
  anchorX: number;
};

const DEFAULT_AUTO_COLLAPSE_LEVEL = 4;

const NODE_WIDTH = VIET_NODE_WIDTH;
const NODE_HEIGHT = VIET_NODE_HEIGHT;
const AVATAR_SIZE = VIET_AVATAR_SIZE;
let SPOUSE_GAP = VIET_SPOUSE_GAP;
let SIBLING_GAP = VIET_SIBLING_GAP;
let MARRIAGE_GROUP_GAP = VIET_MARRIAGE_GROUP_GAP;
let GENERATION_GAP = VIET_GENERATION_GAP;
let CHILD_BAR_OFFSET = VIET_CHILD_BAR_OFFSET;

function applyTreeSpacing(compact: boolean) {
  const scale = compact ? 0.5 : 1;

  SPOUSE_GAP = Math.round(VIET_SPOUSE_GAP * scale);
  SIBLING_GAP = Math.round(VIET_SIBLING_GAP * scale);
  MARRIAGE_GROUP_GAP = Math.round(VIET_MARRIAGE_GROUP_GAP * scale);
  GENERATION_GAP = Math.round(VIET_GENERATION_GAP * scale);
  CHILD_BAR_OFFSET = Math.round(VIET_CHILD_BAR_OFFSET * scale);
}

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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [layoutPerformance, setLayoutPerformance] = useState({
    durationMs: 0,
    measuredAt: "",
  });

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
  const [compactTree, setCompactTree] = useState(false);
  const [autoCollapseLevel, setAutoCollapseLevel] = useState(
    DEFAULT_AUTO_COLLAPSE_LEVEL,
  );

  applyTreeSpacing(compactTree);

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
    const startedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const root = roots[0];

    if (!root) {
      setLayoutPerformance({
        durationMs: 0,
        measuredAt: new Date().toISOString(),
      });
      return null;
    }

    const block = buildTreeBlock({
      person: root,
      familyIndex,
      manualExpandedIds,
      manualCollapsedIds,
      autoCollapseLevel,
      filters,
      level: 0,
      visited: new Set(),
    });

    const endedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    setLayoutPerformance({
      durationMs: Math.round((endedAt - startedAt) * 100) / 100,
      measuredAt: new Date().toISOString(),
    });

    return block;
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
    compactTree,
  ]);

  const diagnostics = useMemo(() => {
    if (!rootBlock) {
      return {
        totalPersons: personsMap.size,
        totalFamilies: families.filter((family) => !family.deleted_at).length,
        visibleNodes: 0,
        visiblePeople: 0,
        visibleFamilyGroups: 0,
        expandedGroups: 0,
        collapsedGroups: 0,
        maxDepth: 0,
        spouseNodes: 0,
        multiSpousePeople: 0,
        width: 0,
        height: 0,
        layoutDurationMs: layoutPerformance.durationMs,
        measuredAt: layoutPerformance.measuredAt,
      };
    }

    return collectTreeDiagnostics({
      rootBlock,
      personsMap,
      families,
      familyParents,
      layoutPerformance,
    });
  }, [rootBlock, personsMap, families, familyParents, layoutPerformance]);

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
        compactTree={compactTree}
        setCompactTree={setCompactTree}
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

      <TreeDiagnosticsPanel
        diagnostics={diagnostics}
        show={showDiagnostics}
        setShow={setShowDiagnostics}
        setAutoCollapseLevel={setAutoCollapseLevel}
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
              className="vietnamese-tree-svg rounded-2xl bg-linear-to-br from-stone-50 to-white"
            
              style={{
                colorScheme: "only light",
                forcedColorAdjust: "none",
                backgroundColor: "#fffbeb",
              }}>
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

type TreeDiagnostics = {
  totalPersons: number;
  totalFamilies: number;
  visibleNodes: number;
  visiblePeople: number;
  visibleFamilyGroups: number;
  expandedGroups: number;
  collapsedGroups: number;
  maxDepth: number;
  spouseNodes: number;
  multiSpousePeople: number;
  width: number;
  height: number;
  layoutDurationMs: number;
  measuredAt: string;
};

function getTreeHealthStatus(diagnostics: TreeDiagnostics) {
  const danger =
    diagnostics.visibleNodes >= 600 || diagnostics.layoutDurationMs >= 150;

  const warning =
    diagnostics.visibleNodes >= 300 || diagnostics.layoutDurationMs >= 80;

  if (danger) {
    return {
      level: "danger" as const,
      label: "Heavy tree",
      className: "border-red-200 bg-red-50 text-red-800",
      message:
        "Cây đang nặng. Nên thu gọn bớt nhánh, tăng auto-collapse hoặc lọc bớt node trước khi thao tác.",
    };
  }

  if (warning) {
    return {
      level: "warning" as const,
      label: "Large tree",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      message:
        "Cây khá lớn. Nếu thao tác bị chậm, hãy tăng auto-collapse hoặc ẩn bớt nhóm node.",
    };
  }

  return {
    level: "ok" as const,
    label: "Healthy",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    message: "Layout đang trong ngưỡng ổn.",
  };
}

function TreeDiagnosticsPanel({
  diagnostics,
  show,
  setShow,
  setAutoCollapseLevel,
}: {
  diagnostics: TreeDiagnostics;
  show: boolean;
  setShow: (value: boolean) => void;
  setAutoCollapseLevel: (value: number) => void;
}) {
  const health = getTreeHealthStatus(diagnostics);
  const [copied, setCopied] = useState(false);

  function recommendCollapse() {
    setAutoCollapseLevel(4);
  }

  async function copySnapshot() {
    const snapshot = {
      kind: "vietnamese-tree-diagnostics",
      version: "v2.3.7",
      capturedAt: new Date().toISOString(),
      url:
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "",
      health: {
        level: health.level,
        label: health.label,
      },
      diagnostics,
    };

    const text = JSON.stringify(snapshot, null, 2);

    try {
      const copiedByClipboardApi =
        typeof navigator !== "undefined" &&
        Boolean(navigator.clipboard?.writeText) &&
        window.isSecureContext;

      if (copiedByClipboardApi) {
        await navigator.clipboard.writeText(text);
      } else {
        copyTextWithTextareaFallback(text);
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      try {
        copyTextWithTextareaFallback(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        setCopied(false);
        console.log("Vietnamese tree diagnostics snapshot:", snapshot);
        window.alert(
          "Không copy được tự động. Snapshot đã được ghi vào Console.",
        );
      }
    }
  }

  return (
    <div className="absolute right-4 top-4 z-30 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white/95 px-3 py-2 text-xs font-bold text-stone-700 shadow-sm backdrop-blur hover:bg-stone-50"
      >
        <Activity className="size-4" />
        Tree diagnostics
      </button>

      {show ? (
        <div className="w-72 rounded-2xl border border-stone-200 bg-white/95 p-4 text-xs text-stone-700 shadow-xl backdrop-blur">
          <div className="mb-3 font-bold text-stone-900">
            Vietnamese tree diagnostics
          </div>

          <div className={`mb-3 rounded-xl border px-3 py-2 ${health.className}`}>
            <div className="text-xs font-black uppercase tracking-wide">
              {health.label}
            </div>
            <div className="mt-1 text-[11px] leading-snug">
              {health.message}
            </div>
          </div>

          <button
            type="button"
            onClick={copySnapshot}
            className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white hover:bg-stone-800"
          >
            {copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
            {copied ? "Copied snapshot" : "Copy snapshot"}
          </button>

          {health.level !== "ok" ? (
            <button
              type="button"
              onClick={recommendCollapse}
              className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800"
            >
              Auto-collapse to 4 generations
            </button>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <DiagnosticItem label="Total persons" value={diagnostics.totalPersons} />
            <DiagnosticItem label="Families" value={diagnostics.totalFamilies} />
            <DiagnosticItem label="Visible nodes" value={diagnostics.visibleNodes} />
            <DiagnosticItem label="Visible people" value={diagnostics.visiblePeople} />
            <DiagnosticItem label="Family groups" value={diagnostics.visibleFamilyGroups} />
            <DiagnosticItem label="Expanded" value={diagnostics.expandedGroups} />
            <DiagnosticItem label="Collapsed" value={diagnostics.collapsedGroups} />
            <DiagnosticItem label="Max depth" value={diagnostics.maxDepth} />
            <DiagnosticItem label="Spouse nodes" value={diagnostics.spouseNodes} />
            <DiagnosticItem label="Multi-spouse" value={diagnostics.multiSpousePeople} />
            <DiagnosticItem label="Width" value={Math.round(diagnostics.width)} />
            <DiagnosticItem label="Height" value={Math.round(diagnostics.height)} />
            <DiagnosticItem
              label="Layout ms"
              value={Math.round(diagnostics.layoutDurationMs)}
            />
          </div>

          {diagnostics.measuredAt ? (
            <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-[11px] text-stone-500">
              Measured: {new Date(diagnostics.measuredAt).toLocaleTimeString("vi-VN")}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function copyTextWithTextareaFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!ok) {
    throw new Error("document.execCommand copy failed");
  }
}

function DiagnosticItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-stone-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-black text-stone-900">{value}</div>
    </div>
  );
}

function collectTreeDiagnostics({
  rootBlock,
  personsMap,
  families,
  familyParents,
  layoutPerformance,
}: {
  rootBlock: TreeBlock;
  personsMap: Map<string, Person>;
  families: FamilyRow[];
  familyParents: FamilyParentRow[];
  layoutPerformance: {
    durationMs: number;
    measuredAt: string;
  };
}): TreeDiagnostics {
  const visiblePeopleIds = new Set<string>();
  const multiSpousePeopleIds = new Set<string>();

  let visibleNodes = 0;
  let visibleFamilyGroups = 0;
  let expandedGroups = 0;
  let collapsedGroups = 0;
  let spouseNodes = 0;
  let maxDepth = 0;

  const spouseCountByPersonId = new Map<string, number>();

  for (const parent of familyParents) {
    spouseCountByPersonId.set(
      parent.person_id,
      (spouseCountByPersonId.get(parent.person_id) ?? 0) + 1,
    );
  }

  for (const [personId, count] of spouseCountByPersonId.entries()) {
    if (count > 1) multiSpousePeopleIds.add(personId);
  }

  function visit(block: TreeBlock, depth: number) {
    maxDepth = Math.max(maxDepth, depth);
    visibleNodes += block.nodes.length;

    for (const node of block.nodes) {
      visiblePeopleIds.add(node.person.id);
      if (node.role === "spouse") spouseNodes += 1;
    }

    visibleFamilyGroups += block.groups.length;

    for (const group of block.groups) {
      if (group.expanded) {
        expandedGroups += 1;
      } else if (group.hasChildren) {
        collapsedGroups += 1;
      }

      if (group.expanded) {
        for (const child of group.visibleChildren) {
          visit(child.block, depth + 1);
        }
      }
    }
  }

  visit(rootBlock, 1);

  return {
    totalPersons: personsMap.size,
    totalFamilies: families.filter((family) => !family.deleted_at).length,
    visibleNodes,
    visiblePeople: visiblePeopleIds.size,
    visibleFamilyGroups,
    expandedGroups,
    collapsedGroups,
    maxDepth,
    spouseNodes,
    multiSpousePeople: multiSpousePeopleIds.size,
    width: rootBlock.width,
    height: rootBlock.height,
    layoutDurationMs: layoutPerformance.durationMs,
    measuredAt: layoutPerformance.measuredAt,
  };
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

  const nodeByPersonId = new Map(
    block.nodes.map((node) => [node.person.id, node]),
  );

  return (
    <>
      <g>
        {block.groups.map((group) => (
          <MarriageConnector
            key={`marriage-${group.groupId}`}
            group={group}
            mainPersonId={block.person.id}
            nodeByPersonId={nodeByPersonId}
            x={x}
            y={y}
            unitCenterY={unitCenterY}
          />
        ))}

        {block.groups
          .filter((group) => group.expanded && group.visibleChildren.length > 0)
          .map((group) => {
            const childCenters = group.visibleChildren.map(
              (slot) => x + group.x + slot.x + slot.childTopCenterX,
            );

            const firstChildCenter = Math.min(...childCenters);
            const lastChildCenter = Math.max(...childCenters);
            const anchorX = x + group.childAnchorX;

            return (
              <g key={`group-lines-${group.groupId}`}>
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
                  const childCenterX =
                    x + group.x + slot.x + slot.childTopCenterX;

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
              </g>
            );
          })}
      </g>

      <g>
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

        {block.groups.map((group) => (
          <MarriageRing
            key={`ring-${group.groupId}`}
            group={group}
            x={x}
            y={unitCenterY}
          />
        ))}

        {!hideExpandButtons
          ? block.groups
              .filter((group) => group.hasChildren && group.spouses.length > 0)
              .map((group) => (
                <g
                  key={`toggle-${group.groupId}`}
                  transform={`translate(${x + group.childAnchorX - 12}, ${
                    unitCenterY + 18
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

      <g>
        {block.groups
          .filter((group) => group.expanded && group.visibleChildren.length > 0)
          .map((group) =>
            group.visibleChildren.map((slot) => (
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
            )),
          )}
      </g>
    </>
  );
}

function MarriageConnector({
  group,
  mainPersonId,
  nodeByPersonId,
  x,
  y,
  unitCenterY,
}: {
  group: FamilyGroup;
  mainPersonId: string;
  nodeByPersonId: Map<string, LayoutNode>;
  x: number;
  y: number;
  unitCenterY: number;
}) {
  if (group.spouses.length === 0) return null;

  const mainNode = nodeByPersonId.get(mainPersonId);
  if (!mainNode) return null;

  return (
    <>
      {group.spouses.map((spouse) => {
        const spouseNode = nodeByPersonId.get(spouse.id);
        if (!spouseNode) return null;

        return (
          <line
            key={`${group.groupId}-${spouse.id}`}
            x1={x + mainNode.x + NODE_WIDTH / 2}
            y1={unitCenterY}
            x2={x + spouseNode.x + NODE_WIDTH / 2}
            y2={unitCenterY}
            stroke={isEndedFamily(group.family) ? "#ef4444" : LINE_COLOR}
            strokeWidth={2}
            strokeDasharray={isEndedFamily(group.family) ? "8 6" : undefined}
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}

function MarriageRing({
  group,
  x,
  y,
}: {
  group: FamilyGroup;
  x: number;
  y: number;
}) {
  if (group.spouses.length === 0) return null;

  const ended = isEndedFamily(group.family);
  const primary = ended ? "#ef4444" : "#f59e0b";
  const secondary = ended ? "#fca5a5" : "#d6a21e";

  return (
    <g transform={`translate(${x + group.anchorX - 10}, ${y - 31})`}>
      <title>{ended ? "Đã ly hôn / đã kết thúc" : "Hôn nhân"}</title>
      <circle
        cx={7}
        cy={10}
        r={6}
        fill="white"
        stroke={secondary}
        strokeWidth={1.8}
      />
      <circle
        cx={13}
        cy={10}
        r={6}
        fill="none"
        stroke={primary}
        strokeWidth={1.8}
      />
      <path
        d="M7 2 L10 0 L13 2"
        fill="none"
        stroke={primary}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {ended ? (
        <line
          x1={3}
          y1={18}
          x2={17}
          y2={2}
          stroke={primary}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
}

function isEndedFamily(family: FamilyRow) {
  return family.status === "divorced" || family.status === "separated";
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
  const palette = getGenderPalette(node.person);
  const dateParts = getPersonDateParts(node.person);
  const nameLines = splitNameIntoLines(node.person.full_name ?? "", 13);
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
          fill={getPersonCardFill(node.person, isHovered)}
          stroke={isHovered ? "#f59e0b" : "#d6d3d1"}
          strokeWidth={isHovered ? 2 : 1.35}
          filter={
            isHovered
              ? "url(#viet-node-hover-shadow)"
              : "url(#viet-node-shadow)"
          }
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
          fontSize={12}
          fontWeight={700}
          fill={isHovered ? "#92400e" : "#292524"}
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
              fontWeight={500}
              fill="#78716c"
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
        fill={palette.avatarBg}
        stroke="white"
        strokeWidth={3}
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

  let groupDrafts: GroupDraft[] = rawFamilies.map((family) => {
    const parentRows = familyIndex.parentsByFamilyId.get(family.id) ?? [];

    const parentPeople = parentRows
      .map((row) => familyIndex.personById.get(row.person_id))
      .filter(Boolean) as Person[];

    const visibleSpouses = parentPeople
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

    const childLayout = expanded
      ? layoutChildBlocksByBiologicalCenters(childBlocks)
      : emptyBiologicalChildLayout();
    const childrenWidth = childLayout.width;

    return {
      family,
      groupId,
      parents: parentPeople,
      spouses: visibleSpouses,
      children,
      childBlocks,
      expanded,
      childLayout,
      childrenWidth,
      groupWidth: Math.max(childrenWidth, NODE_WIDTH),
    };
  });

  groupDrafts = mergeHiddenSpouseGroups({
    person,
    groups: groupDrafts,
  });

  if (groupDrafts.length === 0) {
    return buildSinglePersonBlock(person);
  }

  const groupSlots = layoutFamilyGroupSlots(groupDrafts);

  const positionedPeople = new Map<string, { person: Person; x: number }>();

  if (person.gender === "female") {
    const husbandGroups = groupDrafts
      .map((group, index) => ({
        group,
        slot: groupSlots[index],
        husband: pickMaleSpouse(group.spouses),
      }))
      .filter((item) => item.husband);

    for (const item of husbandGroups) {
      const husband = item.husband!;
      const husbandX = item.slot.anchorX - NODE_WIDTH - SPOUSE_GAP / 2;

      positionedPeople.set(husband.id, {
        person: husband,
        x: husbandX,
      });
    }

    const hasVisibleSpouse = husbandGroups.length > 0;

    if (hasVisibleSpouse) {
      const rightMostHusbandRight = Math.max(
        ...husbandGroups.map((item) => {
          const husband = item.husband!;
          const pos = positionedPeople.get(husband.id);
          return (pos?.x ?? 0) + NODE_WIDTH;
        }),
      );

      positionedPeople.set(person.id, {
        person,
        x: rightMostHusbandRight + SPOUSE_GAP,
      });
    } else {
      const center = centerOfGroupAnchors(groupSlots);
      positionedPeople.set(person.id, {
        person,
        x: center - NODE_WIDTH / 2,
      });
    }

    let extraX = positionedPeople.get(person.id)!.x + NODE_WIDTH + SPOUSE_GAP;

    for (const group of groupDrafts) {
      for (const spouse of group.spouses) {
        if (spouse.gender === "male") continue;
        if (positionedPeople.has(spouse.id)) continue;

        positionedPeople.set(spouse.id, {
          person: spouse,
          x: extraX,
        });

        extraX += NODE_WIDTH + SPOUSE_GAP;
      }
    }
  } else {
    const wifeGroups = groupDrafts
      .map((group, index) => ({
        group,
        slot: groupSlots[index],
        wife: pickFemaleSpouse(group.spouses),
      }))
      .filter((item) => item.wife);

    for (const item of wifeGroups) {
      const wife = item.wife!;
      const wifeX = item.slot.anchorX + SPOUSE_GAP / 2;

      positionedPeople.set(wife.id, {
        person: wife,
        x: wifeX,
      });
    }

    const hasVisibleSpouse = wifeGroups.length > 0;

    if (hasVisibleSpouse) {
      const leftMostWifeLeft = Math.min(
        ...wifeGroups.map((item) => {
          const wife = item.wife!;
          const pos = positionedPeople.get(wife.id);
          return pos?.x ?? 0;
        }),
      );

      positionedPeople.set(person.id, {
        person,
        x: leftMostWifeLeft - SPOUSE_GAP - NODE_WIDTH,
      });
    } else {
      const center = centerOfGroupAnchors(groupSlots);
      positionedPeople.set(person.id, {
        person,
        x: center - NODE_WIDTH / 2,
      });
    }

    let extraX =
      Math.max(
        ...Array.from(positionedPeople.values()).map(
          (item) => item.x + NODE_WIDTH,
        ),
      ) + SPOUSE_GAP;

    for (const group of groupDrafts) {
      for (const spouse of group.spouses) {
        if (spouse.gender === "female") continue;
        if (positionedPeople.has(spouse.id)) continue;

        positionedPeople.set(spouse.id, {
          person: spouse,
          x: extraX,
        });

        extraX += NODE_WIDTH + SPOUSE_GAP;
      }
    }
  }

  if (!positionedPeople.has(person.id)) {
    const center = centerOfGroupAnchors(groupSlots);
    positionedPeople.set(person.id, {
      person,
      x: center - NODE_WIDTH / 2,
    });
  }

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

  const width = Math.max(maxPeopleRight, maxGroupRight) + shiftX;

  const normalizedPeople = peoplePositions
    .map((item) => ({
      person: item.person,
      x: item.x + shiftX,
    }))
    .sort((a, b) => a.x - b.x);

  const personNode = normalizedPeople.find(
    (item) => item.person.id === person.id,
  );

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

    const hasVisibleSpouse = group.spouses.length > 0;
    const personCenterX = nodeTopCenterX;
    const anchorX = hasVisibleSpouse
      ? slot.anchorX + shiftX
      : personCenterX;

    // Marriage/ring anchor and child-connector anchor are intentionally separated.
    // For visible couples, the child connector stays at the family slot anchor,
    // which is also the center between the parent pair and the biological-child row.
    // When spouses are hidden/merged by filters, the same slot anchor remains based
    // on the visible biological children's own node centers, not on in-law/spouse blocks.
    const childAnchorX =
      group.expanded && group.childrenWidth > 0
        ? slot.anchorX + shiftX
        : anchorX;

    const groupX = slot.x + shiftX;
    const visibleChildren: ChildSlot[] = [];

    if (group.expanded && group.childBlocks.length > 0) {
      for (const [childIndex, childBlock] of group.childBlocks.entries()) {
        visibleChildren.push({
          childId: childBlock.person.id,
          block: childBlock,
          x: group.childLayout.childXs[childIndex] ?? 0,
          childTopCenterX: childBlock.nodeTopCenterX,
        });
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
      childAnchorX,
      orderX: childAnchorX,
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

function mergeHiddenSpouseGroups({
  person,
  groups,
}: {
  person: Person;
  groups: GroupDraft[];
}) {
  const withVisibleSpouse = groups.filter((group) => group.spouses.length > 0);
  const withoutVisibleSpouse = groups.filter(
    (group) => group.spouses.length === 0,
  );

  if (withoutVisibleSpouse.length <= 1) return groups;

  const mergedChildren = withoutVisibleSpouse.flatMap((group) => group.children);
  const mergedChildBlocks = withoutVisibleSpouse.flatMap(
    (group) => group.childBlocks,
  );

  const expanded = withoutVisibleSpouse.some((group) => group.expanded);

  const childLayout = expanded
    ? layoutChildBlocksByBiologicalCenters(mergedChildBlocks)
    : emptyBiologicalChildLayout();
  const childrenWidth = childLayout.width;

  const merged: GroupDraft = {
    family: withoutVisibleSpouse[0].family,
    groupId: `${person.id}::__visible_single_parent`,
    parents: [person],
    spouses: [],
    children: sortVietnamesePeople(mergedChildren),
    childBlocks: mergedChildBlocks,
    expanded,
    childLayout,
    childrenWidth,
    groupWidth: Math.max(childrenWidth, NODE_WIDTH),
  };

  return [...withVisibleSpouse, merged].sort((a, b) =>
    String(a.family.created_at ?? "").localeCompare(
      String(b.family.created_at ?? ""),
    ),
  );
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

function layoutFamilyGroupSlots(groups: GroupDraft[]): GroupSlot[] {
  const slots: GroupSlot[] = [];
  let cursorX = 0;

  for (const group of groups) {
    const width =
      group.expanded && group.childrenWidth > 0
        ? Math.max(group.childrenWidth, NODE_WIDTH)
        : NODE_WIDTH;

    const anchorX =
      group.expanded && group.childrenWidth > 0
        ? cursorX + group.childLayout.anchorOffset
        : cursorX + width / 2;

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

function layoutChildBlocksByBiologicalCenters(
  childBlocks: TreeBlock[],
): BiologicalChildLayout {
  if (childBlocks.length === 0) return emptyBiologicalChildLayout();

  const rawXs: number[] = [];
  let cursorX = 0;

  for (const childBlock of childBlocks) {
    rawXs.push(cursorX);
    cursorX += childBlock.width + SIBLING_GAP;
  }

  const rawLeft = Math.min(...rawXs);
  const rawRight = Math.max(
    ...rawXs.map((childX, index) => childX + childBlocks[index].width),
  );

  const childNodeCenters = rawXs.map(
    (childX, index) => childX + childBlocks[index].nodeTopCenterX,
  );

  // Chỉ lấy tâm các node con ruột/con đẻ còn hiển thị.
  // Không lấy tâm cả childBlock vì childBlock có thể gồm vợ/chồng của con,
  // nếu lấy toàn block sẽ kéo lệch đường nối cha/mẹ khi dâu/rễ hiện hoặc ẩn.
  const biologicalCenter =
    (Math.min(...childNodeCenters) + Math.max(...childNodeCenters)) / 2;

  const shiftX = -rawLeft;

  return {
    width: rawRight - rawLeft,
    anchorOffset: biologicalCenter + shiftX,
    childXs: rawXs.map((childX) => childX + shiftX),
  };
}

function emptyBiologicalChildLayout(): BiologicalChildLayout {
  return {
    width: 0,
    anchorOffset: NODE_WIDTH / 2,
    childXs: [],
  };
}

function centerOfGroupSlots(slots: GroupSlot[]) {
  if (slots.length === 0) return NODE_WIDTH / 2;

  const minX = Math.min(...slots.map((slot) => slot.x));
  const maxX = Math.max(...slots.map((slot) => slot.x + slot.width));

  return (minX + maxX) / 2;
}

function centerOfGroupAnchors(slots: GroupSlot[]) {
  if (slots.length === 0) return NODE_WIDTH / 2;

  const minAnchorX = Math.min(...slots.map((slot) => slot.anchorX));
  const maxAnchorX = Math.max(...slots.map((slot) => slot.anchorX));

  return (minAnchorX + maxAnchorX) / 2;
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
        parentsByFamilyId,
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

function getPersonCardFill(person: Person, isHovered: boolean) {
  if (isHovered) return "#ffffff";

  if (person.is_deceased) {
    if (person.gender === "male") return "#eff6ff";
    if (person.gender === "female") return "#fff1f2";
    return "#f5f5f4";
  }

  if (person.gender === "male") return "#f0f9ff";
  if (person.gender === "female") return "#fff7ed";

  return "#fafaf9";
}

function getGenderPalette(personOrGender?: Person | string | null) {
  const gender =
    typeof personOrGender === "object"
      ? personOrGender?.gender
      : personOrGender;
  const isDeceased =
    typeof personOrGender === "object" ? personOrGender?.is_deceased : false;

  if (gender === "male") {
    return {
      avatarBg: isDeceased ? "#bae6fd" : "#38bdf8",
    };
  }

  if (gender === "female") {
    return {
      avatarBg: isDeceased ? "#fecdd3" : "#fb7185",
    };
  }

  return {
    avatarBg: isDeceased ? "#e7e5e4" : "#a8a29e",
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
