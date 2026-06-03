"use client";

import { useState, useTransition } from "react";
import {
  bulkApproveGedcomMergeSuggestions,
  commitApprovedGedcomMergeSuggestions,
  generateGedcomMergeSuggestions,
  updateGedcomMergeSuggestionStatus,
} from "@/app/actions/import-merge-suggestions";
import { Check, FilePlus2, Loader2, RotateCcw, SkipForward, X } from "lucide-react";

export function GenerateMergeSuggestionsButton({
  sessionId,
}: {
  sessionId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);

    startTransition(async () => {
      const result = await generateGedcomMergeSuggestions({ sessionId });

      if (result.ok) {
        setMessage(result.message);
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-bold">Tạo merge suggestions</h2>
          <p className="mt-1 text-sm">
            Tạo các đề xuất merge từ nhóm “Can create”. Thao tác này chưa ghi vào events.
          </p>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={run}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FilePlus2 className="size-4" />
          )}
          Tạo suggestions
        </button>
      </div>

      {message ? (
        <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm">
          {message}
        </div>
      ) : null}
    </div>
  );
}

export function BulkApproveMergeSuggestionsButton({
  sessionId,
}: {
  sessionId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    const confirmed = window.confirm(
      "Approve tất cả pending merge suggestions? Chưa ghi vào events, chỉ đổi trạng thái suggestions.",
    );

    if (!confirmed) return;

    setMessage(null);

    startTransition(async () => {
      const result = await bulkApproveGedcomMergeSuggestions({ sessionId });

      if (result.ok) {
        setMessage("Đã approve pending suggestions.");
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={run}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Approve pending suggestions
      </button>

      {message ? (
        <div className="mt-2 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
          {message}
        </div>
      ) : null}
    </div>
  );
}

export function MergeSuggestionStatusActions({
  sessionId,
  suggestionId,
  currentStatus,
}: {
  sessionId: string;
  suggestionId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(status: "pending" | "approved" | "skipped" | "rejected") {
    setError(null);

    startTransition(async () => {
      const result = await updateGedcomMergeSuggestionStatus({
        sessionId,
        suggestionId,
        status,
      });

      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  const disabled = isPending || currentStatus === "committed";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || currentStatus === "approved"}
          onClick={() => update("approved")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          <Check className="size-3" />
          Approve
        </button>

        <button
          type="button"
          disabled={disabled || currentStatus === "skipped"}
          onClick={() => update("skipped")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-stone-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          <SkipForward className="size-3" />
          Skip
        </button>

        <button
          type="button"
          disabled={disabled || currentStatus === "rejected"}
          onClick={() => update("rejected")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          <X className="size-3" />
          Reject
        </button>

        <button
          type="button"
          disabled={disabled || currentStatus === "pending"}
          onClick={() => update("pending")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          <RotateCcw className="size-3" />
          Pending
        </button>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
export function CommitApprovedMergeSuggestionsButton({
  sessionId,
  approvedCount,
}: {
  sessionId: string;
  approvedCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    const confirmed = window.confirm(
      `Commit ${approvedCount} approved merge suggestions vào events/person_events? Thao tác này sẽ ghi dữ liệu thật.`,
    );

    if (!confirmed) return;

    setMessage(null);

    startTransition(async () => {
      const result = await commitApprovedGedcomMergeSuggestions({ sessionId });

      if (result.ok) {
        setMessage(JSON.stringify(result.result, null, 2));
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending || approvedCount === 0}
        onClick={run}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FilePlus2 className="size-4" />
        )}
        Commit approved suggestions
      </button>

      {message ? (
        <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-stone-900 px-3 py-2 text-xs text-white">
          {message}
        </pre>
      ) : null}
    </div>
  );
}
