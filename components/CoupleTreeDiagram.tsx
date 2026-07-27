"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  Crosshair,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Person, Relationship } from "@/types";
import { usePanZoom } from "@/hooks/usePanZoom";
import { useMemberListView } from "@/context/MemberListContext";
import {
  buildParentChildEdges,
  getDirectParents,
} from "@/utils/tree/lineageComparison";
import { VIET_CHILD_BAR_OFFSET } from "@/utils/tree/vietnameseTreeLayout";
import {
  buildCoupleTreeDiagram,
  buildMarriageUnitsByPerson,
  type CoupleTreeDiagramLayout,
  type CoupleTreeConnector,
  type CoupleTreeNode,
} from "@/utils/tree/centeredCoupleTreeLayout";
import type {
  FamilyChildRow,
  FamilyParentRow,
  FamilyRow,
} from "@/services/statistics/globalStats.service";

export type CoupleTreeMode = "noi-ngoai" | "sui-gia";

interface CoupleTreeDiagramProps {
  mode: CoupleTreeMode;
  rootPersonId: string;
  persons: Person[];
  relationships: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
}

const AVATAR_SIZE = 56;

export default function CoupleTreeDiagram({
  mode,
  rootPersonId,
  persons,
  relationships,
  families = [],
  familyParents = [],
  familyChildren = [],
}: CoupleTreeDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [generationsUp, setGenerationsUp] = useState(4);
  const [generationsDown, setGenerationsDown] = useState(4);
  const [hideDaughtersInLaw, setHideDaughtersInLaw] = useState(false);
  const [hideSonsInLaw, setHideSonsInLaw] = useState(false);
  const [showAddressHint, setShowAddressHint] = useState(false);
  const [showBirthOrder, setShowBirthOrder] = useState(true);
  const [includeClan, setIncludeClan] = useState(false);
  const [branchFilter, setBranchFilter] = useState<"paternal" | "maternal">("paternal");
  const [selectedSpouseId, setSelectedSpouseId] = useState<string | null>(null);

  const router = useRouter();
  const { showAvatar } = useMemberListView();

  const personsMap = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const edgeCtx = useMemo(() => {
    return {
      parentChildEdges: buildParentChildEdges({ relationships, families, familyParents, familyChildren }),
      marriageUnitsByPerson: buildMarriageUnitsByPerson({
        persons,
        relationships,
        families,
        familyParents,
        familyChildren,
      }),
    };
  }, [persons, relationships, families, familyParents, familyChildren]);

  // Danh sách vợ/chồng của người gốc (kể cả đã ly hôn, để vẫn chọn xem được) — chỉ cần cho chế độ Sui gia.
  const rootSpouses = useMemo(() => {
    if (mode !== "sui-gia" || !rootPersonId) return [];
    const units = edgeCtx.marriageUnitsByPerson.get(rootPersonId) ?? [];
    return units
      .map((unit) => (unit.spouseId ? personsMap.get(unit.spouseId) : undefined))
      .filter((p): p is Person => Boolean(p));
  }, [mode, rootPersonId, edgeCtx.marriageUnitsByPerson, personsMap]);

  useEffect(() => {
    if (mode !== "sui-gia") return;
    if (selectedSpouseId && rootSpouses.some((s) => s.id === selectedSpouseId)) return;
    setSelectedSpouseId(rootSpouses[0]?.id ?? null);
  }, [mode, rootSpouses, selectedSpouseId]);

  const { personAId, personBId } = useMemo(() => {
    if (mode === "sui-gia") {
      return { personAId: rootPersonId, personBId: selectedSpouseId };
    }

    const { fatherId, motherId } = getDirectParents(rootPersonId, edgeCtx.parentChildEdges, personsMap);
    return { personAId: fatherId, personBId: motherId };
  }, [mode, rootPersonId, selectedSpouseId, edgeCtx.parentChildEdges, personsMap]);

  const layout = useMemo<CoupleTreeDiagramLayout>(() => {
    if (!personAId && !personBId) {
      return {
        nodes: [],
        connectors: [],
        width: 0,
        height: 0,
        rootCenter: { x: 0, y: 0 },
        personA: null,
        personB: null,
        warnings:
          mode === "noi-ngoai"
            ? ["Người gốc chưa có cha lẫn mẹ trong dữ liệu."]
            : ["Người gốc chưa có vợ/chồng nào trong dữ liệu."],
      };
    }

    return buildCoupleTreeDiagram({
      personAId,
      personBId,
      persons,
      relationships,
      families,
      familyParents,
      familyChildren,
      generationsUp,
      generationsDown,
      hideDaughtersInLaw,
      hideSonsInLaw,
      addressingRootId: rootPersonId,
      highlightPersonId: mode === "noi-ngoai" ? rootPersonId : null,
      includeClan,
      branchFilter: mode === "sui-gia" ? branchFilter : "both",
    });
  }, [
    personAId,
    personBId,
    persons,
    relationships,
    families,
    familyParents,
    familyChildren,
    generationsUp,
    generationsDown,
    hideDaughtersInLaw,
    hideSonsInLaw,
    rootPersonId,
    mode,
    includeClan,
    branchFilter,
  ]);

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

  const centerOnRoot = useCallback(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.scrollLeft = layout.rootCenter.x - el.clientWidth / 2;
    el.scrollTop = Math.max(0, layout.rootCenter.y - el.clientHeight / 3);
  }, [layout.rootCenter]);

  useEffect(() => {
    const raf = requestAnimationFrame(centerOnRoot);
    return () => cancelAnimationFrame(raf);
  }, [centerOnRoot]);

  const openPerson = (personId: string) => {
    router.push(`/dashboard/members/${personId}`);
  };

  if (!rootPersonId) return null;

  return (
    <div className="w-full space-y-3 px-4 pb-8 sm:px-6 lg:px-8">
      {mode === "sui-gia" && rootSpouses.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 text-sm shadow-sm">
          <span className="font-semibold text-stone-700">Vợ/chồng:</span>
          {rootSpouses.map((spouse) => {
            const unit = (edgeCtx.marriageUnitsByPerson.get(rootPersonId) ?? []).find(
              (u) => u.spouseId === spouse.id,
            );
            return (
              <button
                key={spouse.id}
                onClick={() => setSelectedSpouseId(spouse.id)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  selectedSpouseId === spouse.id
                    ? "border-amber-300 bg-amber-100 text-amber-900"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {spouse.full_name}
                {unit?.isEnded ? <span className="ml-1 text-xs text-red-500">(đã ly hôn)</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {layout.warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-3.5" />
            Lưu ý dữ liệu
          </div>
          <ul className="list-inside list-disc space-y-0.5">
            {layout.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="relative h-[70vh] min-h-[480px] w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowOptions((v) => !v)}
                className={`flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold shadow-sm backdrop-blur-md transition ${
                  showOptions
                    ? "border-amber-300 bg-amber-100 text-amber-900"
                    : "border-stone-200/60 bg-white/80 text-stone-600 hover:bg-white"
                }`}
              >
                <SlidersHorizontal className="size-4" />
                Tuỳ chọn
                <ChevronDown className={`size-3.5 transition-transform ${showOptions ? "rotate-180" : ""}`} />
              </button>

              {showOptions ? (
                <div className="absolute right-0 top-12 z-30 w-72 space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-semibold text-stone-700">Số đời trên</span>
                      <select
                        value={generationsUp}
                        onChange={(e) => setGenerationsUp(Number(e.target.value))}
                        className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-amber-400"
                      >
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n} đời
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-semibold text-stone-700">Số đời dưới</span>
                      <select
                        value={generationsDown}
                        onChange={(e) => setGenerationsDown(Number(e.target.value))}
                        className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-amber-400"
                      >
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n} đời
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-1.5 border-t border-stone-100 pt-3">
                    <OptionToggle label="Ẩn dâu" active={hideDaughtersInLaw} onClick={() => setHideDaughtersInLaw((v) => !v)} />
                    <OptionToggle label="Ẩn rể" active={hideSonsInLaw} onClick={() => setHideSonsInLaw((v) => !v)} />
                    <OptionToggle
                      label="Dòng họ"
                      description="Vợ/chồng + con cháu của cô/chú/bác/dì/cậu"
                      active={includeClan}
                      onClick={() => setIncludeClan((v) => !v)}
                    />
                    <OptionToggle
                      label="Danh xưng"
                      description="Người gốc gọi ai bằng gì"
                      active={showAddressHint}
                      onClick={() => setShowAddressHint((v) => !v)}
                    />
                    <OptionToggle
                      label="Thứ tự sinh"
                      description="Số thứ tự sinh trong nhà"
                      active={showBirthOrder}
                      onClick={() => setShowBirthOrder((v) => !v)}
                    />
                  </div>

                  {mode === "sui-gia" ? (
                    <div className="space-y-1.5 border-t border-stone-100 pt-3">
                      <span className="text-xs font-semibold text-stone-700">Nhánh (áp dụng cho cả 2 bên)</span>
                      <div className="flex items-center overflow-hidden rounded-lg border border-stone-200">
                        {(
                          [
                            { value: "paternal", label: "Nhánh nội" },
                            { value: "maternal", label: "Nhánh ngoại" },
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setBranchFilter(option.value)}
                            className={`flex-1 px-2 py-1.5 text-xs font-semibold transition ${
                              branchFilter === option.value
                                ? "bg-amber-100 text-amber-900"
                                : "bg-white text-stone-500 hover:bg-stone-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center overflow-hidden rounded-full border border-stone-200/60 bg-white/80 shadow-sm backdrop-blur-md">
              <button
                onClick={handleZoomOut}
                className="h-10 px-3 text-stone-600 transition-colors hover:bg-stone-100/50 disabled:opacity-50"
                title="Thu nhỏ"
                disabled={scale <= 0.3}
              >
                <ZoomOut className="size-4" />
              </button>
              <button
                onClick={handleResetZoom}
                className="h-10 min-w-[50px] border-x border-stone-200/50 px-2 text-center text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100/50"
                title="Đặt lại"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="h-10 px-3 text-stone-600 transition-colors hover:bg-stone-100/50 disabled:opacity-50"
                title="Phóng to"
                disabled={scale >= 2}
              >
                <ZoomIn className="size-4" />
              </button>
            </div>
            <button
              onClick={centerOnRoot}
              className="flex size-10 items-center justify-center rounded-full border border-stone-200/60 bg-white/80 text-stone-600 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-stone-900 hover:shadow-md"
              title="Căn giữa"
            >
              <Crosshair className="size-4" />
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className={`h-full w-full overflow-auto bg-stone-50 ${isPressed ? "cursor-grabbing" : "cursor-grab"}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onClickCapture={handleClickCapture}
          onDragStart={(e) => e.preventDefault()}
        >
          {layout.nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-stone-400">
              Không có dữ liệu để vẽ sơ đồ.
            </div>
          ) : (
            <div className="inline-block p-8" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <svg
                width={layout.width}
                height={layout.height}
                className="rounded-2xl bg-linear-to-br from-stone-50 to-white"
                style={{ colorScheme: "only light", forcedColorAdjust: "none" }}
              >
                <defs>
                  <filter id="couple-node-shadow" x="-25%" y="-25%" width="150%" height="150%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.10" />
                  </filter>
                  <filter id="couple-node-hover-shadow" x="-35%" y="-35%" width="170%" height="170%">
                    <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.22" />
                  </filter>
                </defs>

                {layout.connectors.map((connector) => (
                  <Connector key={connector.id} connector={connector} />
                ))}

                {layout.nodes.map((node) => (
                  <PersonNode
                    key={node.id}
                    node={node}
                    showAvatar={showAvatar}
                    showAddressHint={showAddressHint}
                    showBirthOrder={showBirthOrder}
                    isHovered={hoveredNodeId === node.id}
                    setHoveredNodeId={setHoveredNodeId}
                    onOpenPerson={openPerson}
                  />
                ))}
              </svg>
            </div>
          )}
        </div>

        <CoupleTreeMinimap containerRef={containerRef} layout={layout} scale={scale} />
      </div>

      <Legend mode={mode} />
    </div>
  );
}

function OptionToggle({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
        active ? "border-amber-300 bg-amber-50 text-amber-900" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
      }`}
    >
      <span>
        {label}
        {description ? <span className="ml-1 font-normal text-stone-400">— {description}</span> : null}
      </span>
      <span
        className={`ml-2 flex size-4 shrink-0 items-center justify-center rounded-full border ${
          active ? "border-amber-500 bg-amber-500" : "border-stone-300 bg-white"
        }`}
      >
        {active ? <span className="size-1.5 rounded-full bg-white" /> : null}
      </span>
    </button>
  );
}

function Connector({ connector }: { connector: CoupleTreeConnector }) {
  if (connector.kind === "spouse") {
    const midX = (connector.x1 + connector.x2) / 2;
    const midY = connector.y1;

    return (
      <g>
        <line
          x1={connector.x1}
          y1={connector.y1}
          x2={connector.x2}
          y2={connector.y2}
          stroke={connector.isEnded ? "#fca5a5" : "#d6d3d1"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={connector.isEnded ? "8 6" : undefined}
        />
        <MarriageRing x={midX} y={midY} isEnded={!!connector.isEnded} />
      </g>
    );
  }

  const bendY = connector.y2 - VIET_CHILD_BAR_OFFSET;
  const d = `M ${connector.x1} ${connector.y1} V ${bendY} H ${connector.x2} V ${connector.y2}`;
  return (
    <path
      d={d}
      fill="none"
      stroke="#d6d3d1"
      strokeWidth={2}
      strokeDasharray={connector.dashed ? "7 5" : undefined}
    />
  );
}

/** Icon nhẫn cưới nhỏ tại điểm hợp hôn — giống MarriageRing của Sơ đồ cây chính. Khi đã ly hôn/ly thân, đổi sang icon "nhẫn vỡ" màu đỏ. */
function MarriageRing({ x, y, isEnded }: { x: number; y: number; isEnded: boolean }) {
  const primary = isEnded ? "#ef4444" : "#f59e0b";
  const secondary = isEnded ? "#fca5a5" : "#d6a21e";

  return (
    <g transform={`translate(${x - 10}, ${y - 31})`}>
      <title>{isEnded ? "Đã ly hôn / đã kết thúc" : "Hôn nhân"}</title>
      <circle cx={7} cy={10} r={6} fill="white" stroke={secondary} strokeWidth={1.8} />
      <circle cx={13} cy={10} r={6} fill="none" stroke={primary} strokeWidth={1.8} />
      <path d="M7 2 L10 0 L13 2" fill="none" stroke={primary} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      {isEnded ? (
        <line x1={3} y1={18} x2={17} y2={2} stroke={primary} strokeWidth={1.8} strokeLinecap="round" />
      ) : null}
    </g>
  );
}

function PersonNode({
  node,
  showAvatar,
  showAddressHint,
  showBirthOrder,
  isHovered,
  setHoveredNodeId,
  onOpenPerson,
}: {
  node: CoupleTreeNode;
  showAvatar: boolean;
  showAddressHint: boolean;
  showBirthOrder: boolean;
  isHovered: boolean;
  setHoveredNodeId: (id: string | null) => void;
  onOpenPerson: (personId: string) => void;
}) {
  const palette = getSidePalette(node);
  const dateParts = getPersonDateParts(node.person);
  const nameLines = splitNameIntoLines(node.person.full_name ?? "", 13);
  const avatarHref = getAvatarHref(node.person);

  const scale = isHovered ? 1.055 : 1;
  const translateX = isHovered ? -(node.width * (scale - 1)) / 2 : 0;
  const translateY = isHovered ? -(node.height * (scale - 1)) / 2 - 5 : 0;

  const addressLabel = showAddressHint ? node.addressHint : null;
  const addressPillWidth = addressLabel ? Math.max(40, addressLabel.length * 6.4 + 16) : 0;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
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
        style={{ transition: "transform 160ms ease-out, filter 160ms ease-out" }}
      >
        <rect
          width={node.width}
          height={node.height}
          rx={16}
          fill={isHovered ? "#ffffff" : palette.fill}
          stroke={isHovered ? "#f59e0b" : palette.stroke}
          strokeWidth={isHovered ? 2 : 1.35}
          filter={isHovered ? "url(#couple-node-hover-shadow)" : "url(#couple-node-shadow)"}
        />

        {node.isHighlighted ? (
          <rect
            x={-4}
            y={-4}
            width={node.width + 8}
            height={node.height + 8}
            rx={19}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ) : null}

        {showAvatar ? <Avatar person={node.person} avatarBg={palette.avatarBg} href={avatarHref} /> : null}

        <text
          x={node.width / 2}
          y={showAvatar ? (nameLines.length > 1 ? 82 : 90) : nameLines.length > 1 ? 40 : 49}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill={isHovered ? "#92400e" : "#292524"}
        >
          {nameLines.map((line, index) => (
            <tspan key={`${line}-${index}`} x={node.width / 2} dy={index === 0 ? 0 : 13}>
              {line}
            </tspan>
          ))}
        </text>

        {dateParts ? (
          <>
            <text x={node.width / 2} y={showAvatar ? 112 : 74} textAnchor="middle" fontSize={9.8} fontWeight={500} fill="#78716c">
              {dateParts.prefix}
            </text>
            {dateParts.age ? (
              <text x={node.width / 2} y={showAvatar ? 128 : 92} textAnchor="middle" fontSize={9.8} fill="#57534e">
                <tspan>(</tspan>
                <tspan fontWeight={900}>{dateParts.age}</tspan>
                <tspan> tuổi)</tspan>
              </text>
            ) : null}
          </>
        ) : null}

        {/* Thứ tự sinh — vòng tròn nhỏ giữa cạnh trên */}
        {showBirthOrder && node.birthOrder != null ? (
          <g>
            <circle cx={node.width / 2} cy={0} r={11} fill="#fffbeb" stroke="#f59e0b" strokeWidth={1.5} />
            <text x={node.width / 2} y={0} dy="0.32em" textAnchor="middle" fontSize={10.5} fontWeight={800} fill="#b45309">
              {node.birthOrder}
            </text>
          </g>
        ) : null}

        {/* Danh xưng — khung nhỏ giữa cạnh dưới, giống nhãn ngày giỗ/sinh nhật ở trang sự kiện */}
        {addressLabel ? (
          <g transform={`translate(${node.width / 2 - addressPillWidth / 2}, ${node.height - 8})`}>
            <rect
              width={addressPillWidth}
              height={16}
              rx={5}
              fill="#fffbeb"
              stroke="#fde68a"
              strokeWidth={1}
            />
            <text
              x={addressPillWidth / 2}
              y={8}
              dy="0.32em"
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              letterSpacing={0.3}
              fill="#b45309"
              style={{ textTransform: "uppercase" }}
            >
              {addressLabel}
            </text>
          </g>
        ) : null}
      </g>
    </g>
  );
}

function Avatar({ person, avatarBg, href }: { person: Person; avatarBg: string; href: string }) {
  const avatarX = 28;
  const avatarY = 12;
  const clipId = `couple-avatar-clip-${person.id}`;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={avatarX + AVATAR_SIZE / 2} cy={avatarY + AVATAR_SIZE / 2} r={AVATAR_SIZE / 2} />
        </clipPath>
      </defs>
      <circle cx={avatarX + AVATAR_SIZE / 2} cy={avatarY + AVATAR_SIZE / 2} r={AVATAR_SIZE / 2 + 3} fill={avatarBg} stroke="white" strokeWidth={3} />
      <image href={href} x={avatarX} y={avatarY} width={AVATAR_SIZE} height={AVATAR_SIZE} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
    </g>
  );
}

function CoupleTreeMinimap({
  containerRef,
  layout,
  scale,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  layout: CoupleTreeDiagramLayout;
  scale: number;
}) {
  const MINIMAP_WIDTH = 180;
  const MINIMAP_HEIGHT = 70;
  const PADDING = 20;

  const [viewport, setViewport] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    clientWidth: 0,
    clientHeight: 0,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      setViewport({
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
      });
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [containerRef]);

  if (layout.nodes.length === 0 || layout.width <= 0 || layout.height <= 0) {
    return null;
  }

  const totalWidth = layout.width + PADDING * 2;
  const totalHeight = layout.height + PADDING * 2;
  const mmScale = Math.min(MINIMAP_WIDTH / totalWidth, MINIMAP_HEIGHT / totalHeight);

  const toMiniX = (worldX: number) => (worldX + PADDING) * mmScale;
  const toMiniY = (worldY: number) => (worldY + PADDING) * mmScale;

  const viewX = viewport.scrollLeft / scale;
  const viewY = viewport.scrollTop / scale;
  const viewW = viewport.clientWidth / scale;
  const viewH = viewport.clientHeight / scale;

  function handleMinimapClick(event: React.MouseEvent<SVGSVGElement>) {
    const el = containerRef.current;
    if (!el) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const worldX = clickX / mmScale - PADDING;
    const worldY = clickY / mmScale - PADDING;

    el.scrollTo({
      left: Math.max(0, worldX * scale - el.clientWidth / 2),
      top: Math.max(0, worldY * scale - el.clientHeight / 2),
      behavior: "smooth",
    });
  }

  return (
    <div
      className="absolute bottom-4 right-4 z-40 rounded-xl border border-stone-200/70 bg-white/90 backdrop-blur-md shadow-lg p-1.5"
      title="Vị trí hiện tại trên sơ đồ"
    >
      <svg
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`}
        className="cursor-pointer rounded-lg bg-stone-50"
        onClick={handleMinimapClick}
      >
        {layout.nodes.map((node) => (
          <circle
            key={node.id}
            cx={toMiniX(node.x + node.width / 2)}
            cy={toMiniY(node.y + node.height / 2)}
            r={1.4}
            fill={node.side === "personA" ? "#38bdf8" : node.side === "personB" ? "#f472b6" : "#a8a29e"}
          />
        ))}

        <rect
          x={toMiniX(viewX)}
          y={toMiniY(viewY)}
          width={Math.max(4, viewW * mmScale)}
          height={Math.max(4, viewH * mmScale)}
          fill="rgba(217,119,6,0.15)"
          stroke="#d97706"
          strokeWidth={1.5}
          rx={2}
        />
      </svg>
    </div>
  );
}

function Legend({ mode }: { mode: CoupleTreeMode }) {
  const items =
    mode === "noi-ngoai"
      ? [
          { label: "Họ nội (bên cha)", color: "#0ea5e9" },
          { label: "Họ ngoại (bên mẹ)", color: "#f472b6" },
          { label: "Con cháu", color: "#10b981" },
          { label: "Người gốc đang chọn", color: "#f59e0b" },
        ]
      : [
          { label: "Bên người gốc", color: "#0ea5e9" },
          { label: "Bên sui gia (vợ/chồng)", color: "#f472b6" },
          { label: "Con cháu", color: "#10b981" },
        ];

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white/80 px-4 py-2.5 text-xs text-stone-600">
      <div className="flex flex-wrap items-center gap-3">
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <span className="flex items-center gap-1.5 border-l border-stone-200 pl-4">
        <span className="inline-block size-2.5 rounded-full border border-slate-300 bg-slate-50" />
        Anh chị em ruột (cô/chú/bác/dì/cậu — luôn hiện)
      </span>
      <span className="flex items-center gap-1.5 border-l border-stone-200 pl-4">
        <svg width={22} height={10} className="shrink-0">
          <line x1={1} y1={5} x2={21} y2={5} stroke="#a8a29e" strokeWidth={2} strokeDasharray="7 5" />
        </svg>
        Đường nét đứt = con nuôi
      </span>
      <span className="flex items-center gap-1.5 border-l border-stone-200 pl-4">
        <svg width={22} height={10} className="shrink-0">
          <line x1={1} y1={5} x2={21} y2={5} stroke="#fca5a5" strokeWidth={2} strokeDasharray="8 6" />
        </svg>
        Đường đỏ nét đứt = đã ly hôn/ly thân
      </span>
    </div>
  );
}

function getAvatarBg(person: Person): string {
  if (person.gender === "female") return person.is_deceased ? "#fecdd3" : "#fb7185";
  return person.is_deceased ? "#bae6fd" : "#38bdf8";
}

function getSidePalette(node: CoupleTreeNode) {
  if (node.side === "personA") {
    return {
      fill: node.role === "sibling" ? "#f8fafc" : node.role === "spouse" ? "#f0f9ff" : "#e0f2fe",
      stroke: node.role === "sibling" ? "#cbd5e1" : "#7dd3fc",
      avatarBg: getAvatarBg(node.person),
      badgeText: "#0369a1",
    };
  }

  if (node.side === "personB") {
    return {
      fill: node.role === "sibling" ? "#f8fafc" : node.role === "spouse" ? "#fff1f5" : "#fce7f3",
      stroke: node.role === "sibling" ? "#cbd5e1" : "#f9a8d4",
      avatarBg: getAvatarBg(node.person),
      badgeText: "#be185d",
    };
  }

  return {
    fill: node.role === "spouse" ? "#fdf4e7" : "#ecfdf5",
    stroke: "#6ee7b7",
    avatarBg: getAvatarBg(node.person),
    badgeText: "#047857",
  };
}

function getAvatarHref(person: Person) {
  if (person.avatar_url) return person.avatar_url;
  if (person.gender === "female") return "/avatar/v2/female.svg";
  return "/avatar/v2/male.svg";
}

function getPersonDateParts(person: Person): { prefix: string; age: number | null } | null {
  const birthYear = person.birth_year ?? null;
  const birthMonth = person.birth_month ?? null;
  const birthDay = person.birth_day ?? null;

  if (!birthYear) return null;

  if (person.is_deceased && person.death_year) {
    return { prefix: `${birthYear} - ${person.death_year}`, age: calculateDeathAge(person) };
  }

  return { prefix: formatBirthDate(birthYear, birthMonth, birthDay), age: calculateLivingAge(person) };
}

function formatBirthDate(year: number, month?: number | null, day?: number | null) {
  if (day && month) return `${pad2(day)}-${pad2(month)}-${year}`;
  if (month) return `${pad2(month)}-${year}`;
  return String(year);
}

function calculateLivingAge(person: Person) {
  if (!person.birth_year) return null;
  const now = new Date();
  let age = now.getFullYear() - person.birth_year;
  if (person.birth_month) {
    const currentMonth = now.getMonth() + 1;
    if (currentMonth < person.birth_month || (currentMonth === person.birth_month && person.birth_day && now.getDate() < person.birth_day)) {
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
      (person.death_month === person.birth_month && person.birth_day && person.death_day && person.death_day < person.birth_day)
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

  if (lines.length < 2 && current) lines.push(current);
  if (lines.length === 2 && clean.length > lines.join(" ").length) {
    lines[1] = `${lines[1].slice(0, Math.max(1, maxChars - 1))}…`;
  }

  return lines.slice(0, 2);
}
