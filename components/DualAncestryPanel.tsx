"use client";

import { useMemo, useState } from "react";
import type { Person, Relationship } from "@/types";
import MaternalPaternalTree from "@/components/MaternalPaternalTree";
import {
  buildDualAncestryGraph,
  type DualAncestryGraph,
} from "@/utils/tree/buildDualAncestryGraph";
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
}

function getDisplayName(person: Person): string {
  return person.full_name || person.id;
}

export default function DualAncestryPanel({
  persons,
  relationships,
  families = [],
  familyParents = [],
  familyChildren = [],
}: DualAncestryPanelProps) {
  const sortedPersons = useMemo(() => {
    return [...persons].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b), "vi"),
    );
  }, [persons]);

  const [rootPersonId, setRootPersonId] = useState<string>(
    sortedPersons[0]?.id ?? "",
  );
  const [generationsUp, setGenerationsUp] = useState(3);
  const [generationsDown, setGenerationsDown] = useState(3);
  const [includeSpouses, setIncludeSpouses] = useState(true);
  const [includeInLaws, setIncludeInLaws] = useState(true);

  const graph: DualAncestryGraph = useMemo(() => {
    return buildDualAncestryGraph({
      rootPersonId,
      generationsUp,
      generationsDown,
      includeSpouses,
      includeInLaws,
      persons,
      relationships,
      families,
      familyParents,
      familyChildren,
    });
  }, [
    rootPersonId,
    generationsUp,
    generationsDown,
    includeSpouses,
    includeInLaws,
    persons,
    relationships,
    families,
    familyParents,
    familyChildren,
  ]);

  if (persons.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        Chưa có dữ liệu thành viên.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr]">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-stone-700">Người gốc</span>
            <select
              value={rootPersonId}
              onChange={(event) => setRootPersonId(event.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-amber-400"
            >
              {sortedPersons.map((person) => (
                <option key={person.id} value={person.id}>
                  {getDisplayName(person)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-stone-700">Số đời trước</span>
            <select
              value={generationsUp}
              onChange={(event) => setGenerationsUp(Number(event.target.value))}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none focus:border-amber-400"
            >
              {[1, 2, 3, 4, 5].map((n) => (
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

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-stone-600">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeSpouses}
              onChange={(event) => setIncludeSpouses(event.target.checked)}
              className="size-4 rounded border-stone-300"
            />
            Hiển thị vợ/chồng của người gốc
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeInLaws}
              onChange={(event) => setIncludeInLaws(event.target.checked)}
              className="size-4 rounded border-stone-300"
            />
            Hiển thị dâu/rễ liên quan
          </label>
        </div>
      </div>

      <MaternalPaternalTree graph={graph} />
    </div>
  );
}
