"use client";

import { useState, useTransition } from "react";
import {
  bulkResetSkippedPersonMatches,
  bulkSkipPendingPersonMatches,
} from "@/app/actions/import-staging-records";
import { Loader2, RotateCcw, SkipForward } from "lucide-react";

export default function ImportMatchReviewBulkActions({
  sessionId,
  possibleMatches,
}: {
  sessionId: string;
  possibleMatches: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function skipAllPossibleMatches() {
    const confirmed = window.confirm(
      `Skip tất cả ${possibleMatches} possible matches? Chỉ làm việc này nếu bạn chắc đây là file GEDCOM export từ chính app hoặc các record này đã có trong DB.`,
    );

    if (!confirmed) return;

    setMessage(null);

    startTransition(async () => {
      const result = await bulkSkipPendingPersonMatches({ sessionId });

      if (result.ok) {
        setMessage("Đã skip tất cả possible matches.");
      } else {
        setMessage(result.error);
      }
    });
  }

  function resetPossibleMatches() {
    const confirmed = window.confirm(
      "Reset các person match review đã skipped về pending để duyệt lại?",
    );

    if (!confirmed) return;

    setMessage(null);

    startTransition(async () => {
      const result = await bulkResetSkippedPersonMatches({ sessionId });

      if (result.ok) {
        setMessage("Đã reset possible matches về pending.");
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold">Bulk xử lý possible matches</h2>
          <p className="mt-1 text-sm">
            Dùng cho trường hợp import lại file GEDCOM export từ chính app.
            Thao tác này chỉ đổi trạng thái staging records, không ghi dữ liệu chính.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending || possibleMatches === 0}
            onClick={skipAllPossibleMatches}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SkipForward className="size-4" />
            )}
            Skip tất cả possible matches
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={resetPossibleMatches}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Reset match review
          </button>
        </div>
      </div>

      {message ? (
        <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm">
          {message}
        </div>
      ) : null}
    </section>
  );
}
