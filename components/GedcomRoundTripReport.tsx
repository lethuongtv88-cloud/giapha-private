import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  GitCompareArrows,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type StagingRecordLike = {
  record_type: string;
  action: string;
  status: string;
  confidence: string;
  warnings?: unknown;
  errors?: unknown;
};

type ImportSummaryLike = {
  persons?: number;
  names?: number;
  families?: number;
  familyParents?: number;
  familyChildren?: number;
  events?: number;
  personEvents?: number;
  matches?: number;
  possibleMatches?: number;
  warnings?: number;
  errors?: number;
};

export default function GedcomRoundTripReport({
  sessionId,
  summary,
  records,
}: {
  sessionId: string;
  summary: ImportSummaryLike | null;
  records: StagingRecordLike[];
}) {
  const persons = toNumber(summary?.persons);
  const matches = toNumber(summary?.matches);
  const possibleMatches = toNumber(summary?.possibleMatches);
  const errors = toNumber(summary?.errors);
  const warnings = toNumber(summary?.warnings);

  const createPersons = records.filter(
    (record) =>
      record.record_type === "person" &&
      record.action === "create" &&
      record.status !== "skipped" &&
      record.status !== "rejected" &&
      record.status !== "committed",
  ).length;

  const pendingPossibleMatches = records.filter(
    (record) =>
      record.record_type === "person" &&
      record.action === "match" &&
      record.status === "pending",
  ).length;

  const activeErrors = records.filter((record) => {
    return getArrayLength(record.errors) > 0;
  }).length;

  const isRoundTripSafe =
    persons > 0 &&
    matches === persons &&
    possibleMatches === 0 &&
    pendingPossibleMatches === 0 &&
    createPersons === 0 &&
    errors === 0 &&
    activeErrors === 0;

  const isAlmostSafe =
    persons > 0 &&
    matches > 0 &&
    matches < persons &&
    possibleMatches === 0 &&
    errors === 0 &&
    activeErrors === 0;

  if (isRoundTripSafe) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-7 shrink-0 text-emerald-600" />
            <div>
              <h2 className="text-lg font-bold">
                GEDCOM round-trip safe
              </h2>
              <p className="mt-1 text-sm text-emerald-800">
                File GEDCOM này match 100% với dữ liệu hiện có. Không có person
                mới, không có possible match, không có lỗi. Đây là kết quả đúng
                cho file export từ chính app rồi import lại.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Metric label="Persons" value={persons} />
                <Metric label="Matches" value={matches} />
                <Metric label="Create persons" value={createPersons} />
                <Metric label="Possible matches" value={possibleMatches} />
                <Metric label="Errors" value={errors + activeErrors} />
              </div>

              {warnings > 0 ? (
                <p className="mt-3 text-xs text-emerald-700">
                  Có {warnings} warnings, chủ yếu do hệ thống đang skip các
                  record phụ của person đã match để tránh duplicate. Với
                  round-trip test, điều này chấp nhận được.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href={`/dashboard/import/${sessionId}/matches`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <GitCompareArrows className="size-4" />
              Xem Match Review
            </Link>

            <div className="rounded-xl bg-white/70 px-3 py-2 text-xs text-emerald-700">
              Không cần commit session này nếu đây chỉ là test export/import.
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isAlmostSafe) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-7 shrink-0 text-amber-600" />
          <div>
            <h2 className="text-lg font-bold">
              GEDCOM gần đạt round-trip, nhưng còn create candidates
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Có match và không có lỗi, nhưng vẫn còn person create candidates.
              Nếu đây là file export từ chính app, cần kiểm tra vì có thể còn
              XREF chưa ổn định hoặc dữ liệu đã thay đổi.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Persons" value={persons} />
              <Metric label="Matches" value={matches} />
              <Metric label="Create persons" value={createPersons} />
              <Metric label="Possible matches" value={possibleMatches} />
              <Metric label="Errors" value={errors + activeErrors} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 text-stone-900 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          {errors > 0 || activeErrors > 0 ? (
            <XCircle className="mt-0.5 size-7 shrink-0 text-red-600" />
          ) : possibleMatches > 0 || pendingPossibleMatches > 0 ? (
            <AlertTriangle className="mt-0.5 size-7 shrink-0 text-amber-600" />
          ) : (
            <FileCheck2 className="mt-0.5 size-7 shrink-0 text-stone-500" />
          )}

          <div>
            <h2 className="text-lg font-bold">GEDCOM round-trip report</h2>
            <p className="mt-1 text-sm text-stone-500">
              Báo cáo nhanh giúp xác định file import có an toàn để round-trip
              hay còn cần review trước khi commit.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Persons" value={persons} />
              <Metric label="Matches" value={matches} />
              <Metric label="Create persons" value={createPersons} />
              <Metric
                label="Pending matches"
                value={pendingPossibleMatches}
              />
              <Metric label="Errors" value={errors + activeErrors} />
            </div>

            <div className="mt-4 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
              {pendingPossibleMatches > 0 ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Còn possible matches chưa duyệt. Hãy mở Match Review trước.
                </div>
              ) : createPersons > 0 ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Còn person create candidates. Chỉ approve nếu đây thật sự là
                  người mới.
                </div>
              ) : errors > 0 || activeErrors > 0 ? (
                <div className="flex items-center gap-2">
                  <XCircle className="size-4 text-red-600" />
                  Còn lỗi trong staging. Không commit.
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  Không có lỗi chính, nhưng chưa đủ điều kiện round-trip 100%.
                </div>
              )}
            </div>
          </div>
        </div>

        <Link
          href={`/dashboard/import/${sessionId}/matches`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
        >
          <GitCompareArrows className="size-4" />
          Mở Match Review
        </Link>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
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

function getArrayLength(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return 0;
}
