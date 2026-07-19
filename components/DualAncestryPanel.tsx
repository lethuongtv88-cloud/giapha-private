"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Person, Relationship } from "@/types";
import PersonSelector from "@/components/PersonSelector";
import LineagePersonCard from "@/components/LineagePersonCard";
import { useUser } from "@/components/UserProvider";
import {
  getRootPreferenceAccountKey,
  readRootPreference,
  writeRootPreference,
} from "@/utils/preferences/rootPreferences";
import {
  buildLineageComparison,
  type LineageComparisonResult,
  type LineagePersonItem,
} from "@/utils/tree/lineageComparison";
import type {
  FamilyChildRow,
  FamilyParentRow,
  FamilyRow,
} from "@/services/statistics/globalStats.service";

interface DualAncestryPanelProps {
  persons: Person[];
  relationships: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
  isRestricted?: boolean;
  viewerPersonId?: string | null;
  permissionWarnings?: string[];
}

function getDisplayName(person: Person): string {
  return person.full_name || person.id;
}

function BranchCell({ items }: { items: LineagePersonItem[] }) {
  if (items.length === 0) {
    return <p className="text-xs italic text-stone-400">Chưa có dữ liệu</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <LineagePersonCard
          key={`${item.person.id}-${item.branch}-${item.generation}-${item.isInLaw ? "inlaw" : "blood"}`}
          person={item.person}
          relationLabel={item.relationLabel}
          note={item.note}
          compact={items.length > 3}
          addressHint={item.addressHint || undefined}
        />
      ))}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={description}
      className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
        active
          ? "border-amber-300 bg-amber-100 text-amber-900 shadow-sm"
          : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
      }`}
    >
      <span>{active ? "✓ " : ""}{label}</span>
      <span className="mt-0.5 block text-[11px] font-normal leading-snug opacity-75">
        {description}
      </span>
    </button>
  );
}

function RootSummary({ graph }: { graph: LineageComparisonResult }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-sm sm:grid-cols-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Người gốc</p>
        <p className="mt-1 font-semibold text-stone-900">{graph.root?.full_name ?? "Chưa chọn"}</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Họ nội</p>
        {graph.father ? (
          <Link
            href={`/dashboard/members?view=tree&rootId=${graph.father.id}`}
            className="mt-1 inline-flex font-semibold text-sky-800 hover:text-sky-950 hover:underline"
          >
            Mở cây từ cha: {graph.father.full_name}
          </Link>
        ) : (
          <p className="mt-1 text-stone-500">Chưa có cha</p>
        )}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Họ ngoại</p>
        {graph.mother ? (
          <Link
            href={`/dashboard/members?view=tree&rootId=${graph.mother.id}`}
            className="mt-1 inline-flex font-semibold text-rose-800 hover:text-rose-950 hover:underline"
          >
            Mở cây từ mẹ: {graph.mother.full_name}
          </Link>
        ) : (
          <p className="mt-1 text-stone-500">Chưa có mẹ</p>
        )}
      </div>
    </div>
  );
}

export default function DualAncestryPanel({
  persons,
  relationships,
  families = [],
  familyParents = [],
  familyChildren = [],
  isRestricted = false,
  viewerPersonId = null,
  permissionWarnings = [],
}: DualAncestryPanelProps) {
  const { user } = useUser();
  const sortedPersons = useMemo(() => {
    return [...persons].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b), "vi"),
    );
  }, [persons]);

  const accountKey = getRootPreferenceAccountKey({
    userId: user?.id,
    email: user?.email,
  });

  const fallbackRootId = useMemo(() => {
    if (viewerPersonId && sortedPersons.some((person) => person.id === viewerPersonId)) {
      return viewerPersonId;
    }

    return sortedPersons[0]?.id ?? "";
  }, [sortedPersons, viewerPersonId]);

  const [rootPersonId, setRootPersonId] = useState<string>(fallbackRootId);
  const [rootPreferenceLoaded, setRootPreferenceLoaded] = useState(false);
  const [generationsUp, setGenerationsUp] = useState(4);
  const [generationsDown, setGenerationsDown] = useState(4);
  const [includeClan, setIncludeClan] = useState(false);
  const [hideDaughtersInLaw, setHideDaughtersInLaw] = useState(false);
  const [hideSonsInLaw, setHideSonsInLaw] = useState(false);

  useEffect(() => {
    if (sortedPersons.length === 0) return;

    const isValidRoot = (id: string | null | undefined) =>
      Boolean(id && sortedPersons.some((person) => person.id === id));

    const savedRootId = readRootPreference("dualAncestry", accountKey);

    if (isValidRoot(rootPersonId)) {
      setRootPreferenceLoaded(true);
      return;
    }

    if (isValidRoot(savedRootId)) {
      setRootPersonId(savedRootId!);
    } else {
      setRootPersonId(fallbackRootId);
    }

    setRootPreferenceLoaded(true);
    // Chỉ load lại khi đổi tài khoản hoặc dữ liệu persons đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, sortedPersons, fallbackRootId]);

  useEffect(() => {
    if (!rootPreferenceLoaded || !rootPersonId) return;
    writeRootPreference("dualAncestry", accountKey, rootPersonId);
  }, [rootPersonId, accountKey, rootPreferenceLoaded]);

  const graph = useMemo(() => {
    return buildLineageComparison({
      rootPersonId,
      generationsUp,
      generationsDown,
      persons,
      relationships,
      families,
      familyParents,
      familyChildren,
      displayOptions: {
        includeClan,
        hideDaughtersInLaw,
        hideSonsInLaw,
      },
    });
  }, [rootPersonId, generationsUp, generationsDown, persons, relationships, families, familyParents, familyChildren, includeClan, hideDaughtersInLaw, hideSonsInLaw]);

  if (persons.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        Chưa có dữ liệu thành viên.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {isRestricted ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
          <p className="font-semibold">Đang áp dụng phạm vi xem theo tài khoản.</p>
          <p className="mt-1">Bạn chỉ thấy các thành viên thuộc nhánh nội/ngoại, vợ/chồng trong nhánh và nhánh bên vợ/chồng trực tiếp của mình.</p>
        </div>
      ) : null}

      {permissionWarnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Lưu ý phân quyền</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {permissionWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr_0.8fr]">
          <PersonSelector
            persons={sortedPersons}
            selectedId={rootPersonId}
            onSelect={(id) => {
              if (id) setRootPersonId(id);
            }}
            label="Người gốc"
            placeholder="Tìm người gốc..."
            className="w-full"
          />

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-stone-700">Số đời trước</span>
            <select
              value={generationsUp}
              onChange={(event) => setGenerationsUp(Number(event.target.value))}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-amber-400"
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} đời
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-stone-700">Số đời sau</span>
            <select
              value={generationsDown}
              onChange={(event) => setGenerationsDown(Number(event.target.value))}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-amber-400"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} đời
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <ToggleButton
            active={includeClan}
            onClick={() => setIncludeClan((value) => !value)}
            label="Dòng họ"
            description="Hiện thêm người cùng hàng: anh em, cô/chú/bác/cậu/dì, con cháu cùng nhánh."
          />
          <ToggleButton
            active={hideDaughtersInLaw}
            onClick={() => setHideDaughtersInLaw((value) => !value)}
            label="Ẩn dâu"
            description="Ẩn các nữ phối ngẫu đi vào dòng họ qua hôn nhân."
          />
          <ToggleButton
            active={hideSonsInLaw}
            onClick={() => setHideSonsInLaw((value) => !value)}
            label="Ẩn rể"
            description="Ẩn các nam phối ngẫu đi vào dòng họ qua hôn nhân."
          />
        </div>

        <p className="mt-4 text-sm text-stone-500">
          Bảng này đặt người gốc ở giữa, họ nội ở cột trái, họ ngoại ở cột phải và con cháu ở cột trung tâm để dễ so tương quan thế hệ. Bật “Dòng họ” để hiện thêm người cùng hàng trong từng đời.
        </p>
      </div>

      <RootSummary graph={graph} />

      {graph.warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Lưu ý dữ liệu</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {graph.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="min-w-[1100px] w-full border-collapse text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th className="w-36 border-b border-stone-200 px-4 py-3">Đời</th>
              <th className="w-[30%] border-b border-stone-200 px-4 py-3 text-sky-800">Họ nội / nhánh cha</th>
              <th className="w-[30%] border-b border-stone-200 px-4 py-3 text-amber-800">Người gốc / hậu duệ</th>
              <th className="w-[30%] border-b border-stone-200 px-4 py-3 text-rose-800">Họ ngoại / nhánh mẹ</th>
            </tr>
          </thead>
          <tbody>
            {graph.rows.map((row) => (
              <tr key={row.generation} className={row.generation === 0 ? "bg-amber-50/40" : "odd:bg-white even:bg-stone-50/40"}>
                <td className="align-top border-b border-stone-100 px-4 py-4 font-semibold text-stone-700">
                  {row.label}
                </td>
                <td className="align-top border-b border-stone-100 px-4 py-4">
                  <BranchCell items={row.paternal} />
                </td>
                <td className="align-top border-b border-stone-100 px-4 py-4">
                  <BranchCell items={row.center} />
                </td>
                <td className="align-top border-b border-stone-100 px-4 py-4">
                  <BranchCell items={row.maternal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
