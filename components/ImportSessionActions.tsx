"use client";

import { useState, useTransition } from "react";
import {
  cancelImportSession,
  deleteUncommittedImportSession,
} from "@/app/actions/import-sessions";
import { Ban, Loader2, Trash2 } from "lucide-react";

export default function ImportSessionActions({
  sessionId,
  status,
}: {
  sessionId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const isCommitted = status === "committed";

  function cancel() {
    setMessage(null);

    startTransition(async () => {
      const result = await cancelImportSession({ sessionId });

      if (!result.ok) {
        setMessage(result.error);
      } else {
        setMessage("Đã hủy session.");
      }
    });
  }

  function remove() {
    const confirmed = window.confirm(
      "Xóa staging session này? Chỉ xóa import_sessions/import_staging_records, không xóa dữ liệu chính.",
    );

    if (!confirmed) return;

    setMessage(null);

    startTransition(async () => {
      const result = await deleteUncommittedImportSession({ sessionId });

      if (!result.ok) {
        setMessage(result.error);
      } else {
        setMessage("Đã xóa staging session.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending || isCommitted || status === "cancelled"}
          onClick={cancel}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Ban className="size-3" />
          )}
          Hủy
        </button>

        <button
          type="button"
          disabled={isPending || isCommitted}
          onClick={remove}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
          Xóa staging
        </button>
      </div>

      {message ? (
        <div className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
          {message}
        </div>
      ) : null}
    </div>
  );
}
