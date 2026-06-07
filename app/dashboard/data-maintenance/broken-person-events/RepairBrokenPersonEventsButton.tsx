"use client";

import { repairBrokenPersonEvents } from "@/app/actions/data-maintenance";
import { useState, useTransition } from "react";

export function RepairBrokenPersonEventsButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const ok = window.confirm(
            "Repair person_events lỗi?\n\nThao tác này sẽ xóa các liên kết person_events trỏ tới person/event không active và soft-delete event mồ côi. Nên backup trước khi chạy.",
          );

          if (!ok) return;

          setMessage(null);
          setError(null);

          startTransition(async () => {
            const result = await repairBrokenPersonEvents();

            if (!result.ok) {
              setError(result.error ?? "Repair thất bại.");
              return;
            }

            setMessage(
              `Đã xóa ${result.result.deletedPersonEvents} person_events lỗi và soft-delete ${result.result.softDeletedOrphanEvents} events mồ côi.`,
            );
          });
        }}
        className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Đang repair..." : "Repair person_events lỗi"}
      </button>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
    </div>
  );
}
