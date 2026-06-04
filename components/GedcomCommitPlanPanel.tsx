"use client";

import { useState, useTransition } from "react";
import { getGedcomCommitPlan } from "@/app/actions/import-commit-plan";
import type { GedcomCommitPlan } from "@/services/import/gedcomCommitPlan.service";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";

export default function GedcomCommitPlanPanel({
  sessionId,
}: {
  sessionId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<GedcomCommitPlan | null>(null);

  function runDryRun() {
    setError(null);
    setPlan(null);

    startTransition(async () => {
      const result = await getGedcomCommitPlan({ sessionId });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setPlan(result.plan);
    });
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">
            Kiểm tra commit staging
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Dry-run chỉ lập kế hoạch commit các record đã approved. Chưa ghi vào dữ liệu chính.
          </p>
        </div>

        <button
          type="button"
          onClick={runDryRun}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ClipboardCheck className="size-4" />
          )}
          Kiểm tra commit
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {plan ? (
        <div className="mt-5 space-y-4">
          <div
            className={`rounded-xl border p-4 text-sm ${
              plan.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {plan.ok ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <AlertTriangle className="size-5" />
              )}
              {plan.ok
                ? "Commit plan hợp lệ"
                : "Commit plan còn lỗi, chưa nên commit thật"}
            </div>
            <p className="mt-1">
              Approved records: <strong>{plan.approvedRecords}</strong>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Count label="Persons" value={plan.counts.persons} />
            <Count label="Person names" value={plan.counts.personNames} />
            <Count label="Families" value={plan.counts.families} />
            <Count label="Family parents" value={plan.counts.familyParents} />
            <Count label="Family children" value={plan.counts.familyChildren} />
            <Count label="Events" value={plan.counts.events} />
            <Count label="Person events" value={plan.counts.personEvents} />
            <Count label="Unsupported" value={plan.counts.unsupported} />
          </div>

          {plan.issues.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-stone-700">
                Issues trước khi commit
              </h3>

              {plan.issues.map((issue, index) => (
                <div
                  key={`${issue.title}-${index}`}
                  className={`rounded-xl border p-3 text-sm ${
                    issue.severity === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : issue.severity === "warning"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-sky-200 bg-sky-50 text-sky-800"
                  }`}
                >
                  <div className="font-semibold">{issue.title}</div>
                  <div className="mt-1">{issue.description}</div>
                  {issue.recordId ? (
                    <div className="mt-1 text-xs opacity-70">
                      Record: {issue.recordId}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-stone-900">{value}</div>
    </div>
  );
}
