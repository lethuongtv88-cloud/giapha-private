import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  GitCompareArrows,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

type StagingRecordLike = {
  record_type: string;
  action: string;
  status: string;
  confidence?: string;
};

type SummaryLike = {
  persons?: number;
  matches?: number;
  possibleMatches?: number;
  errors?: number;
};

type MergeSuggestionLike = {
  status: string;
};

export default function ImportSafetyGate({
  sessionId,
  summary,
  records,
  mergeSuggestions,
}: {
  sessionId: string;
  summary: SummaryLike | null;
  records: StagingRecordLike[];
  mergeSuggestions: MergeSuggestionLike[];
}) {
  const persons = toNumber(summary?.persons);
  const matches = toNumber(summary?.matches);
  const possibleMatches = toNumber(summary?.possibleMatches);
  const errors = toNumber(summary?.errors);

  const pendingPossibleMatches = records.filter(
    (record) =>
      record.record_type === "person" &&
      record.action === "match" &&
      record.status === "pending",
  ).length;

  const activePersonCreates = records.filter(
    (record) =>
      record.record_type === "person" &&
      record.action === "create" &&
      !["skipped", "rejected", "committed"].includes(record.status),
  ).length;

  const approvedCreates = records.filter(
    (record) => record.action === "create" && record.status === "approved",
  ).length;

  const pendingMergeSuggestions = mergeSuggestions.filter(
    (suggestion) => suggestion.status === "pending",
  ).length;

  const approvedMergeSuggestions = mergeSuggestions.filter(
    (suggestion) => suggestion.status === "approved",
  ).length;

  const isRoundTripSafe =
    persons > 0 &&
    matches === persons &&
    possibleMatches === 0 &&
    pendingPossibleMatches === 0 &&
    activePersonCreates === 0 &&
    errors === 0;

  const blockers = [
    pendingPossibleMatches > 0
      ? `${pendingPossibleMatches} possible matches chưa duyệt`
      : null,
    errors > 0 ? `${errors} staging errors` : null,
  ].filter(Boolean) as string[];

  const warnings = [
    activePersonCreates > 0
      ? `${activePersonCreates} person create candidates`
      : null,
    approvedCreates > 0 ? `${approvedCreates} approved create records` : null,
    pendingMergeSuggestions > 0
      ? `${pendingMergeSuggestions} merge suggestions pending`
      : null,
    approvedMergeSuggestions > 0
      ? `${approvedMergeSuggestions} merge suggestions approved, có thể commit merge riêng`
      : null,
  ].filter(Boolean) as string[];

  if (isRoundTripSafe) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-7 shrink-0 text-emerald-600" />
            <div>
              <h2 className="text-lg font-bold">Import safety: round-trip safe</h2>
              <p className="mt-1 text-sm text-emerald-800">
                Tất cả persons trong GEDCOM đã match với dữ liệu hiện có. Không
                có possible match, không có person create, không có error.
              </p>
              <p className="mt-2 text-sm font-semibold text-emerald-800">
                Đây là session kiểm tra export/import, không cần COMMIT.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/import/${sessionId}/matches`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <GitCompareArrows className="size-4" />
              Match Review
            </Link>
            <Link
              href={`/dashboard/import/${sessionId}/audit`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-900"
            >
              Audit
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${
        blockers.length > 0
          ? "border-red-200 bg-red-50 text-red-900"
          : warnings.length > 0
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          {blockers.length > 0 ? (
            <ShieldX className="mt-0.5 size-7 shrink-0 text-red-600" />
          ) : warnings.length > 0 ? (
            <AlertTriangle className="mt-0.5 size-7 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-emerald-600" />
          )}

          <div>
            <h2 className="text-lg font-bold">Import safety gate</h2>

            {blockers.length > 0 ? (
              <div className="mt-2">
                <div className="text-sm font-semibold">Chưa nên commit:</div>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {blockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <div className="mt-2">
                <div className="text-sm font-semibold">Cần kiểm tra kỹ:</div>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {blockers.length === 0 && warnings.length === 0 ? (
              <p className="mt-1 text-sm">
                Không thấy blocker chính. Vẫn nên chạy Audit trước khi commit.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/import/${sessionId}/matches`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            Match Review
          </Link>

          <Link
            href={`/dashboard/import/${sessionId}/merge`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Merge Plan
          </Link>

          <Link
            href={`/dashboard/import/${sessionId}/audit`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-900"
          >
            Audit
          </Link>
        </div>
      </div>
    </section>
  );
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
