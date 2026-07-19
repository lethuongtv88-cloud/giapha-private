"use client";

import { useEffect, useMemo, useState } from "react";
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
  buildInLawComparison,
  type InLawComparisonResult,
  type InLawPersonItem,
} from "@/utils/tree/lineageComparison";
import type {
  FamilyChildRow,
  FamilyParentRow,
  FamilyRow,
} from "@/services/statistics/globalStats.service";

interface InLawRelationsPanelProps {
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

function InLawCell({ items }: { items: InLawPersonItem[] }) {
  if (items.length === 0) {
    return <p className="text-xs italic text-stone-400">Chưa có dữ liệu</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <LineagePersonCard
          key={`${item.person.id}-${item.side}-${item.branch}-${item.generation}-${item.isInLaw ? "inlaw" : "blood"}`}
          person={item.person}
          relationLabel={item.relationLabel}
          addressHint={item.addressHint}
          note={item.note}
          compact={items.length > 2}
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
          ? "border-orange-300 bg-orange-100 text-orange-900 shadow-sm"
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

function SpousePicker({
  graph,
  selectedSpouseId,
  setSelectedSpouseId,
}: {
  graph: InLawComparisonResult;
  selectedSpouseId: string;
  setSelectedSpouseId: (id: string) => void;
}) {
  if (graph.spouses.length === 0) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Người gốc chưa có vợ/chồng hiện hành nên chưa thể dựng bảng sui gia.
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-stone-700">Chọn vợ/chồng để so sui gia</span>
      <select
        value={selectedSpouseId}
        onChange={(event) => setSelectedSpouseId(event.target.value)}
        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-amber-400"
      >
        {graph.spouses.map((spouse) => (
          <option key={spouse.id} value={spouse.id}>
            {spouse.full_name}
            {spouse.birth_year ? ` (${spouse.birth_year})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function InLawRelationsPanel({
  persons,
  relationships,
  families = [],
  familyParents = [],
  familyChildren = [],
  isRestricted = false,
  viewerPersonId = null,
  permissionWarnings = [],
}: InLawRelationsPanelProps) {
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

  const restrictedRootId = useMemo(() => {
    if (isRestricted && viewerPersonId && sortedPersons.some((person) => person.id === viewerPersonId)) {
      return viewerPersonId;
    }

    return null;
  }, [isRestricted, sortedPersons, viewerPersonId]);

  const fallbackRootId = restrictedRootId ?? sortedPersons[0]?.id ?? "";

  const [rootPersonId, setRootPersonId] = useState<string>(fallbackRootId);
  const [rootPreferenceLoaded, setRootPreferenceLoaded] = useState(false);
  const [selectedSpouseId, setSelectedSpouseId] = useState<string>("");
  const [generationsUp, setGenerationsUp] = useState(3);
  const [generationsDown, setGenerationsDown] = useState(3);
  const [includeClan, setIncludeClan] = useState(false);
  const [hideDaughtersInLaw, setHideDaughtersInLaw] = useState(false);
  const [hideSonsInLaw, setHideSonsInLaw] = useState(false);

  useEffect(() => {
    if (sortedPersons.length === 0) return;

    if (restrictedRootId) {
      setRootPersonId(restrictedRootId);
      setRootPreferenceLoaded(true);
      return;
    }

    const isValidRoot = (id: string | null | undefined) =>
      Boolean(id && sortedPersons.some((person) => person.id === id));

    const savedRootId = readRootPreference("inLaw", accountKey);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, sortedPersons, restrictedRootId, fallbackRootId]);

  useEffect(() => {
    if (!rootPreferenceLoaded || !rootPersonId || isRestricted) return;
    writeRootPreference("inLaw", accountKey, rootPersonId);
  }, [rootPersonId, accountKey, rootPreferenceLoaded, isRestricted]);

  const graph = useMemo(() => {
    return buildInLawComparison({
      rootPersonId,
      spousePersonId: selectedSpouseId || null,
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
  }, [rootPersonId, selectedSpouseId, generationsUp, generationsDown, persons, relationships, families, familyParents, familyChildren, includeClan, hideDaughtersInLaw, hideSonsInLaw]);

  useEffect(() => {
    if (graph.spouses.length === 0) {
      if (selectedSpouseId) setSelectedSpouseId("");
      return;
    }

    if (!selectedSpouseId || !graph.spouses.some((spouse) => spouse.id === selectedSpouseId)) {
      setSelectedSpouseId(graph.spouses[0].id);
    }
  }, [graph.spouses, selectedSpouseId]);

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
          <p className="mt-1">Trang này chỉ hiển thị sui gia trực tiếp của chính người được gắn với tài khoản, không mở rộng sang sui gia của người khác trong nhánh.</p>
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
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1.2fr_0.8fr_0.8fr]">
          {isRestricted ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Sui gia của tôi</p>
              <p className="mt-1 font-semibold">
                {sortedPersons.find((person) => person.id === rootPersonId)?.full_name ?? "Người được gắn với tài khoản"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sky-700">
                Tài khoản thường chỉ được xem sui gia trực tiếp của chính mình.
              </p>
            </div>
          ) : (
            <PersonSelector
              persons={sortedPersons}
              selectedId={rootPersonId}
              onSelect={(id) => {
                if (id) {
                  setRootPersonId(id);
                  setSelectedSpouseId("");
                }
              }}
              label="Người gốc"
              placeholder="Tìm người gốc..."
              className="w-full"
            />
          )}

          <SpousePicker
            graph={graph}
            selectedSpouseId={selectedSpouseId}
            setSelectedSpouseId={setSelectedSpouseId}
          />

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-stone-700">Số đời trước</span>
            <select
              value={generationsUp}
              onChange={(event) => setGenerationsUp(Number(event.target.value))}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-amber-400"
            >
              {[2, 3, 4, 5].map((n) => (
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
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} đời
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Tuỳ chọn hiển thị</p>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <ToggleButton
            active={includeClan}
            onClick={() => setIncludeClan((value) => !value)}
            label="Dòng họ"
            description="Hiện thêm người cùng hàng hai bên sui gia trong từng đời."
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
          Bảng sui gia đặt nội/ngoại bên người gốc cạnh nội/ngoại bên vợ/chồng để so thế hệ và gợi ý cách xưng hô khi gặp họ hàng hai bên. Bật “Dòng họ” để hiện thêm người cùng hàng trong từng nhánh; chọn kiểu xưng hô theo vùng miền để phù hợp cách gọi trong gia đình.
        </p>
      </div>

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
        <table className="min-w-[1040px] w-full border-collapse text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th className="w-24 border-b border-stone-200 px-2.5 py-3">Đời</th>
              <th className="w-[18%] border-b border-stone-200 px-2.5 py-3 text-sky-800">Nội bên người gốc</th>
              <th className="w-[18%] border-b border-stone-200 px-2.5 py-3 text-rose-800">Ngoại bên người gốc</th>
              <th className="w-[20%] border-b border-stone-200 px-2.5 py-3 text-amber-800">Cặp vợ chồng / hậu duệ</th>
              <th className="w-[18%] border-b border-stone-200 px-2.5 py-3 text-sky-800">Nội bên vợ/chồng</th>
              <th className="w-[18%] border-b border-stone-200 px-2.5 py-3 text-rose-800">Ngoại bên vợ/chồng</th>
            </tr>
          </thead>
          <tbody>
            {graph.rows.map((row) => (
              <tr key={row.generation} className={row.generation === 0 ? "bg-amber-50/40" : "odd:bg-white even:bg-stone-50/40"}>
                <td className="align-top border-b border-stone-100 px-2.5 py-3 font-semibold text-stone-700">
                  {row.label}
                </td>
                <td className="align-top border-b border-stone-100 px-2.5 py-3">
                  <InLawCell items={row.rootPaternal} />
                </td>
                <td className="align-top border-b border-stone-100 px-2.5 py-3">
                  <InLawCell items={row.rootMaternal} />
                </td>
                <td className="align-top border-b border-stone-100 px-2.5 py-3">
                  <InLawCell items={row.couple} />
                </td>
                <td className="align-top border-b border-stone-100 px-2.5 py-3">
                  <InLawCell items={row.spousePaternal} />
                </td>
                <td className="align-top border-b border-stone-100 px-2.5 py-3">
                  <InLawCell items={row.spouseMaternal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
