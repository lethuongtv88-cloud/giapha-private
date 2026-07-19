"use client";

import { useState, useTransition } from "react";
import { commitGedcomStagingSession } from "@/app/actions/import-commit";
import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2 } from "lucide-react";

type CommitResult = Awaited<ReturnType<typeof commitGedcomStagingSession>>;

export default function GedcomCommitExecutePanel({
  sessionId,
}: {
  sessionId: string;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CommitResult | null>(null);

  const canCommit = confirmText.trim() === "COMMIT";

  function runCommit() {
    if (!canCommit) return;

    setResult(null);

    startTransition(async () => {
      const res = await commitGedcomStagingSession({ sessionId });
      setResult(res);
    });
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-6 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-red-900">
            Commit staging vào dữ liệu chính
          </h2>
          <p className="mt-1 text-sm text-red-800">
            Thao tác này sẽ ghi các record đã approved vào persons, person_names,
            families, family_parents, family_children, events và person_events.
            Chỉ bấm sau khi đã chạy “Kiểm tra commit” và không còn error.
          </p>

          <div className="mt-4 rounded-xl border border-red-200 bg-white/70 p-4">
            <label className="block text-sm font-semibold text-red-900">
              Nhập COMMIT để xác nhận
            </label>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="COMMIT"
              className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-red-900 outline-none focus:border-red-500"
            />

            <button
              type="button"
              disabled={!canCommit || isPending}
              onClick={runCommit}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <DatabaseZap className="size-4" />
              )}
              Commit thật
            </button>
          </div>

          {result ? (
            <div
              className={`mt-4 rounded-xl border p-4 text-sm ${
                result.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-white text-red-800"
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {result.ok ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <AlertTriangle className="size-5" />
                )}
                {result.ok ? "Commit thành công" : "Commit lỗi"}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Count label="Persons" value={result.committed.persons} />
                <Count label="Names" value={result.committed.personNames} />
                <Count label="Families" value={result.committed.families} />
                <Count
                  label="Family parents"
                  value={result.committed.familyParents}
                />
                <Count
                  label="Family children"
                  value={result.committed.familyChildren}
                />
                <Count label="Events" value={result.committed.events} />
                <Count
                  label="Person events"
                  value={result.committed.personEvents}
                />
                <Count
                  label="Staging records"
                  value={result.committed.stagingRecords}
                />
              </div>

              {result.errors.length > 0 ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="font-semibold">Errors</div>
                  <ul className="mt-1 list-inside list-disc">
                    {result.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.warnings.length > 0 ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <div className="font-semibold">Warnings</div>
                  <ul className="mt-1 list-inside list-disc">
                    {result.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}