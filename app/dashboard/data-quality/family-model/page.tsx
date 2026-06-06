import Link from "next/link";
import { DatabaseZap, ShieldCheck, AlertTriangle, Wrench, Eye } from "lucide-react";
import { getSupabase } from "@/utils/supabase/queries";
import {
  familyModelKindLabels,
  familyModelRepairSql,
  runFamilyModelQualityChecks,
  type FamilyModelQualityIssue,
  type FamilyModelQualityKind,
  type FamilyModelQualitySeverity,
} from "@/services/data-quality/familyModelQuality.service";

export const metadata = {
  title: "Family Model Quality",
};

const severityClass: Record<FamilyModelQualitySeverity, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

const severityLabel: Record<FamilyModelQualitySeverity, string> = {
  error: "Lỗi",
  warning: "Cảnh báo",
  info: "Thông tin",
};

const orderedKinds: FamilyModelQualityKind[] = [
  "missing_marriage_family",
  "missing_child_family",
  "duplicate_family_parent",
  "duplicate_family_child",
  "family_child_without_parent",
  "active_empty_family",
  "person_parent_and_child_same_family",
  "family_more_than_two_parents",
  "child_multiple_biological_families",
  "child_more_than_two_biological_parents",
  "relationship_points_to_deleted_person",
  "family_edge_points_to_deleted_person",
];

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "stone" | "red" | "amber" | "emerald";
}) {
  const cls =
    tone === "red"
      ? "border-red-100 bg-red-50 text-red-700"
      : tone === "amber"
        ? "border-amber-100 bg-amber-50 text-amber-700"
        : tone === "emerald"
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : "border-stone-200 bg-white text-stone-700";

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${cls}`}>
      <div className="text-sm opacity-80">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function SqlBlock({ title, sql }: { title: string; sql: string }) {
  return (
    <details className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <summary className="cursor-pointer text-sm font-bold text-stone-800">
        {title}
      </summary>
      <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-stone-950 p-4 text-xs leading-relaxed text-stone-100">
        <code>{sql}</code>
      </pre>
    </details>
  );
}

function IssueCard({ issue }: { issue: FamilyModelQualityIssue }) {
  return (
    <div className={`rounded-xl border p-4 ${severityClass[issue.severity]}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">
              {severityLabel[issue.severity]}
            </span>
            {issue.repairable ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                repairable
              </span>
            ) : (
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">
                review-only
              </span>
            )}
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">
              {familyModelKindLabels[issue.kind]}
            </span>
          </div>

          <h3 className="mt-2 font-bold">{issue.title}</h3>
          <p className="mt-1 text-sm opacity-90">{issue.description}</p>

          {issue.repairHint ? (
            <div className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-sm">
              <span className="font-semibold">Gợi ý: </span>
              {issue.repairHint}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-80">
            {issue.familyIds?.slice(0, 4).map((id) => (
              <span key={`family-${id}`} className="rounded-full bg-white/60 px-2 py-1">
                family: {id}
              </span>
            ))}
            {issue.personIds?.slice(0, 4).map((id) => (
              <span key={`person-${id}`} className="rounded-full bg-white/60 px-2 py-1">
                person: {id}
              </span>
            ))}
            {issue.relationshipIds?.slice(0, 4).map((id) => (
              <span key={`rel-${id}`} className="rounded-full bg-white/60 px-2 py-1">
                rel: {id}
              </span>
            ))}
          </div>
        </div>

        {issue.personIds?.[0] ? (
          <Link
            href={`/dashboard/members/${issue.personIds[0]}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            <Eye className="size-4" />
            Mở person
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function KindSection({
  kind,
  issues,
}: {
  kind: FamilyModelQualityKind;
  issues: FamilyModelQualityIssue[];
}) {
  if (issues.length === 0) return null;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">
            {familyModelKindLabels[kind]}
          </h2>
          <p className="mt-1 text-sm text-stone-500">Tổng: {issues.length} vấn đề.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {issues.slice(0, 60).map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </div>
      {issues.length > 60 ? (
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          Đang hiển thị 60/{issues.length} vấn đề đầu tiên để tránh trang quá dài.
        </div>
      ) : null}
    </section>
  );
}

export default async function FamilyModelQualityPage() {
  const supabase = await getSupabase();

  const [personsRes, relationshipsRes, familiesRes, parentsRes, childrenRes] =
    await Promise.all([
      supabase.from("persons").select("id, full_name, gender, deleted_at"),
      supabase
        .from("relationships")
        .select("id, type, person_a, person_b, deleted_at, created_at"),
      supabase.from("families").select("id, status, deleted_at, created_at, updated_at"),
      supabase.from("family_parents").select("id, family_id, person_id, role, sort_order"),
      supabase
        .from("family_children")
        .select("id, family_id, person_id, relationship_type, sort_order, legacy_relationship_id, migration_confidence"),
    ]);

  const loadErrors = [
    personsRes.error ? `persons: ${personsRes.error.message}` : null,
    relationshipsRes.error ? `relationships: ${relationshipsRes.error.message}` : null,
    familiesRes.error ? `families: ${familiesRes.error.message}` : null,
    parentsRes.error ? `family_parents: ${parentsRes.error.message}` : null,
    childrenRes.error ? `family_children: ${childrenRes.error.message}` : null,
  ].filter(Boolean) as string[];

  const result = runFamilyModelQualityChecks({
    persons: (personsRes.data ?? []) as any,
    relationships: (relationshipsRes.data ?? []) as any,
    families: (familiesRes.data ?? []) as any,
    familyParents: (parentsRes.data ?? []) as any,
    familyChildren: (childrenRes.data ?? []) as any,
  });

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h1 className="title">Family Model Quality</h1>
        <p className="mt-1 text-sm text-stone-500">
          Kiểm tra nâng cao families, family_parents và family_children. Mục tiêu là
          phát hiện lỗi làm cây, Nội/Ngoại, Sui gia và GEDCOM hiển thị sai.
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-emerald-600" />
            <div>
              <h2 className="font-bold">Nguyên tắc an toàn</h2>
              <p className="mt-1 text-sm text-emerald-800">
                Trang này mặc định là audit/preview. Các SQL repair bên dưới chỉ nên
                chạy sau khi đã đọc kết quả và backup dữ liệu.
              </p>
            </div>
          </div>
        </section>

        {loadErrors.length > 0 ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-6 shrink-0" />
              <div>
                <h2 className="font-bold">Không tải đủ dữ liệu</h2>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {loadErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="Tổng vấn đề" value={result.summary.total} tone="stone" />
          <SummaryCard label="Lỗi" value={result.summary.errors} tone="red" />
          <SummaryCard label="Cảnh báo" value={result.summary.warnings} tone="amber" />
          <SummaryCard label="Thông tin" value={result.summary.info} tone="stone" />
          <SummaryCard label="Có thể repair" value={result.summary.repairable} tone="emerald" />
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900">Tóm tắt theo nhóm</h2>
              <p className="mt-1 text-sm text-stone-500">
                Nhóm repairable có thể sửa bằng RPC/SQL sau khi xác nhận.
              </p>
            </div>
            <DatabaseZap className="size-7 text-stone-400" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {orderedKinds.map((kind) => (
              <div key={kind} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="text-sm font-semibold text-stone-800">
                  {familyModelKindLabels[kind]}
                </div>
                <div className="mt-2 text-2xl font-bold text-stone-900">
                  {result.summary.byKind[kind]}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex gap-3">
            <Wrench className="mt-0.5 size-6 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">SQL repair an toàn từng bước</h2>
              <p className="mt-1 text-sm text-amber-800">
                Hai repair đầu dùng RPC ensure_family_model_marriage và
                ensure_family_model_child. Các nhóm duplicate/empty nên preview trước.
              </p>
              <div className="mt-4 space-y-3">
                <SqlBlock title="Repair missing marriage Family Model" sql={familyModelRepairSql.missingMarriage} />
                <SqlBlock title="Repair missing child Family Model" sql={familyModelRepairSql.missingChild} />
                <SqlBlock title="Preview duplicate family_parents" sql={familyModelRepairSql.duplicateParentsPreview} />
                <SqlBlock title="Preview duplicate family_children" sql={familyModelRepairSql.duplicateChildrenPreview} />
                <SqlBlock title="Preview empty active families" sql={familyModelRepairSql.emptyFamiliesPreview} />
              </div>
            </div>
          </div>
        </section>

        {result.summary.total === 0 ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
            Không phát hiện vấn đề Family Model nâng cao.
          </section>
        ) : (
          orderedKinds.map((kind) => (
            <KindSection key={kind} kind={kind} issues={result.groups[kind]} />
          ))
        )}
      </main>
    </div>
  );
}
