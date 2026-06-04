import {
  runDataQualityChecks,
  type DataQualityCategory,
  type DataQualityIssue,
  type DataQualitySeverity,
} from "@/services/data-quality/dataQuality.service";
import { getSupabase } from "@/utils/supabase/queries";
import Link from "next/link";

export const metadata = {
  title: "Data Quality",
};

const categoryLabels: Record<DataQualityCategory, string> = {
  family: "Family Model",
  event: "Event Model",
  tree: "Tree / Graph",
  stats: "Stats / Classifier",
  migration: "Migration Review",
  legacy: "Legacy / Soft delete",
};

const severityLabels: Record<DataQualitySeverity, string> = {
  error: "Lỗi nghiêm trọng",
  warning: "Cảnh báo",
  info: "Thông tin",
};

const severityClass: Record<DataQualitySeverity, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

const severityDot: Record<DataQualitySeverity, string> = {
  error: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "stone" | "red" | "amber" | "sky";
}) {
  const cls =
    tone === "red"
      ? "border-red-100 bg-red-50 text-red-700"
      : tone === "amber"
        ? "border-amber-100 bg-amber-50 text-amber-700"
        : tone === "sky"
          ? "border-sky-100 bg-sky-50 text-sky-700"
          : "border-stone-200 bg-white text-stone-700";

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${cls}`}>
      <div className="text-sm opacity-80">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function IssueCard({ issue }: { issue: DataQualityIssue }) {
  return (
    <div className={`rounded-xl border p-4 ${severityClass[issue.severity]}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-1 size-2.5 shrink-0 rounded-full ${severityDot[issue.severity]}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{issue.title}</h3>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium">
              {severityLabels[issue.severity]}
            </span>
          </div>

          <p className="mt-1 text-sm opacity-90">{issue.description}</p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-80">
            {issue.entityType ? (
              <span className="rounded-full bg-white/60 px-2 py-1">
                {issue.entityType}
              </span>
            ) : null}

            {issue.entityId ? (
              <span className="rounded-full bg-white/60 px-2 py-1">
                ID: {issue.entityId}
              </span>
            ) : null}

            {issue.relatedIds && issue.relatedIds.length > 0 ? (
              <span className="rounded-full bg-white/60 px-2 py-1">
                Related: {issue.relatedIds.slice(0, 4).join(", ")}
                {issue.relatedIds.length > 4
                  ? ` +${issue.relatedIds.length - 4}`
                  : ""}
              </span>
            ) : null}
          </div>

          {issue.suggestion ? (
            <div className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-sm">
              <span className="font-semibold">Gợi ý: </span>
              {issue.suggestion}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  issues,
}: {
  category: DataQualityCategory;
  issues: DataQualityIssue[];
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-stone-900">
          {categoryLabels[category]}
        </h2>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-600">
          {issues.length}
        </span>
      </div>

      {issues.length > 0 ? (
        <div className="space-y-3">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          Không phát hiện vấn đề trong nhóm này.
        </div>
      )}
    </section>
  );
}

export default async function DataQualityPage() {
  const supabase = await getSupabase();

  const [
    personsRes,
    relationshipsRes,
    familiesRes,
    familyParentsRes,
    familyChildrenRes,
    eventsRes,
    personEventsRes,
    migrationReviewRes,
  ] = await Promise.all([
    supabase.from("persons").select("*"),
    supabase.from("relationships").select("*"),
    supabase.from("families").select("*"),
    supabase.from("family_parents").select("*"),
    supabase.from("family_children").select("*"),
    supabase.from("events").select("*"),
    supabase.from("person_events").select("*"),
    supabase.from("migration_review").select("*"),
  ]);

  const loadErrors = [
    personsRes.error ? `persons: ${personsRes.error.message}` : null,
    relationshipsRes.error ? `relationships: ${relationshipsRes.error.message}` : null,
    familiesRes.error ? `families: ${familiesRes.error.message}` : null,
    familyParentsRes.error ? `family_parents: ${familyParentsRes.error.message}` : null,
    familyChildrenRes.error ? `family_children: ${familyChildrenRes.error.message}` : null,
    eventsRes.error ? `events: ${eventsRes.error.message}` : null,
    personEventsRes.error ? `person_events: ${personEventsRes.error.message}` : null,
    migrationReviewRes.error
      ? `migration_review: ${migrationReviewRes.error.message}`
      : null,
  ].filter(Boolean) as string[];

  const result = runDataQualityChecks({
    persons: personsRes.data ?? [],
    relationships: relationshipsRes.data ?? [],
    families: familiesRes.data ?? [],
    familyParents: familyParentsRes.data ?? [],
    familyChildren: familyChildrenRes.data ?? [],
    events: eventsRes.data ?? [],
    personEvents: personEventsRes.data ?? [],
    migrationReview: migrationReviewRes.data ?? [],
  });

  const orderedCategories: DataQualityCategory[] = [
    "family",
    "event",
    "tree",
    "stats",
    "migration",
    "legacy",
  ];

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h1 className="title">Data Quality</h1>
<section className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
  <h2 className="text-lg font-bold text-stone-900">
    Công cụ bảo trì dữ liệu
  </h2>

  <p className="mt-1 text-sm text-stone-500">
    Mở các trang maintenance để xử lý dữ liệu bất thường sau migration/import.
  </p>

  <div className="mt-4 flex flex-wrap gap-2">
    <Link
      href="/dashboard/data-maintenance"
      className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
    >
      Tổng quan maintenance
    </Link>
<Link
  href="/dashboard/admin-health"
  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
>
  Admin Health
</Link>
    <Link
      href="/dashboard/data-maintenance/unknown-persons"
      className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
    >
      Unknown persons
    </Link>

    <Link
      href="/dashboard/data-maintenance/duplicate-events"
      className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
    >
      Duplicate events
    </Link>

    <Link
      href="/dashboard/data-maintenance/events-missing-links"
      className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
    >
      Missing event links
    </Link>

    <Link
      href="/dashboard/data-maintenance/empty-families"
      className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
    >
      Empty families
    </Link>
  </div>
</section>
        <p className="text-stone-500 mt-1 text-sm">
          Kiểm tra chất lượng dữ liệu Family Model, Event Model, Tree, Stats và
          legacy soft-delete trước khi làm GEDCOM staging import hoặc cleanup.
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        {loadErrors.length > 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            <h2 className="font-bold">Có lỗi khi tải dữ liệu</h2>
            <ul className="mt-2 list-inside list-disc text-sm">
              {loadErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Tổng vấn đề" value={result.summary.total} tone="stone" />
          <SummaryCard label="Lỗi nghiêm trọng" value={result.summary.errors} tone="red" />
          <SummaryCard label="Cảnh báo" value={result.summary.warnings} tone="amber" />
          <SummaryCard label="Thông tin" value={result.summary.info} tone="sky" />
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-stone-900">
            Tổng quan theo nhóm
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orderedCategories.map((category) => (
              <div
                key={category}
                className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-stone-600">
                  {categoryLabels[category]}
                </span>
                <span className="text-lg font-bold text-stone-900">
                  {result.summary.byCategory[category]}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          {orderedCategories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              issues={result.groups[category]}
            />
          ))}
        </div>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <h2 className="font-bold">Ghi chú an toàn</h2>
          <p className="mt-2">
            Trang này chỉ kiểm tra dữ liệu. Không rollback Family Model, không
            truncate bảng family, không drop legacy columns, không bật
            ALLOW_LEGACY_CLEANUP. Nếu có lỗi Event/Family, sửa từng case hoặc
            tắt flag đọc schema mới khi cần.
          </p>
        </section>
      </main>
    </div>
  );
}
