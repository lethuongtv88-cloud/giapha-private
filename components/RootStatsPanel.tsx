"use client";

import { useMemo, useState } from "react";
import type { Person, Relationship } from "@/types";
import {
  calculateRootStats,
  type RootStatsResult,
} from "@/services/statistics/rootStats.service";
import type {
  FamilyChildRow,
  FamilyParentRow,
  FamilyRow,
} from "@/services/statistics/globalStats.service";

interface RootStatsPanelProps {
  persons: Person[];
  relationships: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
}

function getDisplayName(person: Person): string {
  return person.full_name || person.id;
}

function StatBox({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-stone-900">{value}</div>
      {note ? <div className="mt-1 text-xs text-stone-400">{note}</div> : null}
    </div>
  );
}

function StatLine({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-stone-100 py-2 last:border-b-0">
      <span className="text-sm text-stone-600">{label}</span>
      <span className="text-sm font-semibold text-stone-900">{value}</span>
    </div>
  );
}

function renderRootName(persons: Person[], rootPersonId: string): string {
  const person = persons.find((item) => item.id === rootPersonId);
  return person ? getDisplayName(person) : "Chưa chọn";
}

export default function RootStatsPanel({
  persons,
  relationships,
  families = [],
  familyParents = [],
  familyChildren = [],
}: RootStatsPanelProps) {
  const sortedPersons = useMemo(() => {
    return [...persons].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b), "vi"),
    );
  }, [persons]);

  const [rootPersonId, setRootPersonId] = useState<string>(
    sortedPersons[0]?.id ?? "",
  );

  const stats: RootStatsResult | null = useMemo(() => {
    if (!rootPersonId) return null;

    return calculateRootStats({
      rootPersonId,
      persons,
      relationships,
      families,
      familyParents,
      familyChildren,
    });
  }, [
    rootPersonId,
    persons,
    relationships,
    families,
    familyParents,
    familyChildren,
  ]);

  if (persons.length === 0) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900">
          Thống kê theo gốc đang chọn
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          Chưa có dữ liệu thành viên để thống kê.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Thống kê theo gốc đang chọn
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Dâu/rễ, họ nội, họ ngoại phụ thuộc vào người gốc. Không dùng số
            “dâu/rễ toàn gia phả”.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-stone-700">Người gốc</span>
          <select
            value={rootPersonId}
            onChange={(event) => setRootPersonId(event.target.value)}
            className="min-w-64 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-stone-500"
          >
            {sortedPersons.map((person) => (
              <option key={person.id} value={person.id}>
                {getDisplayName(person)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {stats ? (
        <>
          <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
            Đang tính theo gốc:{" "}
            <span className="font-semibold text-stone-900">
              {renderRootName(persons, rootPersonId)}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox
              label="Huyết thống"
              value={stats.relation.bloodline}
              note="Người nối được qua cha/mẹ/con"
            />
            <StatBox
              label="Dâu/rễ theo gốc"
              value={stats.relation.inLaws}
              note="Vợ/chồng của huyết thống"
            />
            <StatBox
              label="Họ nội / nhánh cha"
              value={stats.relation.paternalBranch}
              note="Nhánh đi qua cha của root"
            />
            <StatBox
              label="Họ ngoại / nhánh mẹ"
              value={stats.relation.maternalBranch}
              note="Nhánh đi qua mẹ của root"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-stone-900">
                Phân loại quan hệ
              </h3>
              <div className="mt-3">
                <StatLine label="Huyết thống" value={stats.relation.bloodline} />
                <StatLine label="Dâu/rễ theo gốc" value={stats.relation.inLaws} />
                <StatLine
                  label="Nhánh cha / họ nội"
                  value={stats.relation.paternalBranch}
                />
                <StatLine
                  label="Nhánh mẹ / họ ngoại"
                  value={stats.relation.maternalBranch}
                />
                <StatLine
                  label="Xuất hiện cả hai nhánh"
                  value={stats.relation.bothBranches}
                />
                <StatLine label="Chưa phân loại" value={stats.relation.unknown} />
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-stone-900">
                Giới tính trong tập đang xem
              </h3>
              <div className="mt-3">
                <StatLine label="Nam" value={stats.gender.male} />
                <StatLine label="Nữ" value={stats.gender.female} />
                <StatLine label="Khác" value={stats.gender.other} />
                <StatLine label="Chưa rõ" value={stats.gender.unknown} />
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-stone-900">
                Hôn nhân trong tập đang xem
              </h3>
              <div className="mt-3">
                <StatLine label="Có gia đình" value={stats.maritalStatus.married} />
                <StatLine
                  label="Chưa có gia đình"
                  value={stats.maritalStatus.unmarried}
                />
                <StatLine label="Chưa rõ" value={stats.maritalStatus.unknown} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
          Hãy chọn một người gốc để xem thống kê.
        </div>
      )}
    </section>
  );
}
