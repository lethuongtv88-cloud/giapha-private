"use client";

import { useState, useTransition } from "react";
import { softDeleteDuplicateBirthDeathEvents } from "@/app/actions/data-maintenance";
import { Loader2, Trash2 } from "lucide-react";

export default function SoftDeleteDuplicateEventsButton({
  groupCount,
}: {
  groupCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    const confirmed = window.confirm(
      `Soft-delete duplicate birth/death events trong ${groupCount} nhóm? Mỗi nhóm sẽ giữ lại 1 event đại diện, các event trùng còn lại chỉ set deleted_at.`,
    );

    if (!confirmed) return;

    setMessage(null);

    startTransition(async () => {
      const result = await softDeleteDuplicateBirthDeathEvents();

      if (result.ok) {
        setMessage(JSON.stringify(result.result, null, 2));
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-bold">Soft-delete duplicate events</h2>
          <p className="mt-1 text-sm">
            Chỉ xử lý duplicate birth/death exact match theo person, type,
            start_date và sort_date. Mỗi nhóm giữ lại 1 event đại diện. Không
            hard delete.
          </p>
        </div>

        <button
          type="button"
          disabled={isPending || groupCount === 0}
          onClick={run}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Soft-delete duplicates
        </button>
      </div>

      {message ? (
        <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-stone-900 px-3 py-2 text-xs text-white">
          {message}
        </pre>
      ) : null}
    </div>
  );
}
