"use client";

import { useState, useTransition } from "react";
import {
  bulkApprovePendingRecords,
  bulkSkipWarningAndErrorRecords,
  markMatchedPersonAsCreate,
  resetStagingSessionReview,
  updateStagingRecordStatus,
  type StagingRecordStatus,
} from "@/app/actions/import-staging-records";
import { Check, Loader2, RotateCcw, SkipForward, X } from "lucide-react";

export function StagingRecordActions({
  sessionId,
  recordId,
  recordType,
  currentAction,
  currentStatus,
}: {
  sessionId: string;
  recordId: string;
  recordType: string;
  currentAction: string;
  currentStatus: StagingRecordStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = isPending || currentStatus === "committed";

  function update(status: Exclude<StagingRecordStatus, "committed">) {
    setError(null);

    startTransition(async () => {
      const result = await updateStagingRecordStatus({
        sessionId,
        recordId,
        status,
      });

      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  function createAnyway() {
    setError(null);

    startTransition(async () => {
      const result = await markMatchedPersonAsCreate({
        sessionId,
        recordId,
      });

      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || currentStatus === "approved"}
          onClick={() => update("approved")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
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

        {recordType === "person" && currentAction === "match" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={createAnyway}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Check className="size-3" />
            Tạo mới dù nghi trùng
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function StagingSessionBulkActions({
  sessionId,
}: {
  sessionId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(action: "approve" | "skip-risky" | "reset") {
    setMessage(null);

    startTransition(async () => {
      const result =
        action === "approve"
          ? await bulkApprovePendingRecords({ sessionId })
          : action === "skip-risky"
            ? await bulkSkipWarningAndErrorRecords({ sessionId })
            : await resetStagingSessionReview({ sessionId });

      if (result.ok) {
        setMessage("Đã cập nhật.");
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-stone-900">Duyệt nhanh staging</h2>

      <p className="mt-1 text-sm text-stone-500">
        Các thao tác này chỉ đổi trạng thái staging records. Chưa ghi vào dữ
        liệu chính.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run("approve")}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Approve tất cả pending không lỗi
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => run("skip-risky")}
          className="inline-flex items-center gap-2 rounded-xl bg-stone-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <SkipForward className="size-4" />
          Skip warning/error
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => run("reset")}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <RotateCcw className="size-4" />
          Reset về pending
        </button>
      </div>

      {message ? (
        <div className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
          {message}
        </div>
      ) : null}
    </div>
  );
}
