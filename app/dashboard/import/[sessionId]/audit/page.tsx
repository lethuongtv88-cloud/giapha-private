import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Info, ShieldAlert, TriangleAlert, XCircle } from "lucide-react";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { buildImportAuditResult } from "@/services/import/gedcomImportAudit.service";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

type CountRow = {
  count: number;
};

type GroupCountRow = {
  status?: string;
  record_type?: string;
  action?: string;
  suggestion_type?: string;
  count: number;
};

function toneClass(severity: string) {
  if (severity === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (severity === "error") return "border-red-200 bg-red-50 text-red-800";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-sky-200 bg-sky-50 text-sky-800";
}

function IconFor({ severity }: { severity: string }) {
  if (severity === "ok") return <CheckCircle2 className="size-5 text-emerald-600" />;
  if (severity === "error") return <XCircle className="size-5 text-red-600" />;
  if (severity === "warning") return <TriangleAlert className="size-5 text-amber-600" />;
  return <Info className="size-5 text-sky-600" />;
}

function AuditCard({
  label,
  count,
  severity,
}: {
  label: string;
  count: number;
  severity: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass(severity)}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{label}</div>
        <IconFor severity={severity} />
      </div>
      <div className="mt-2 text-3xl font-bold">{count}</div>
      <div className="mt-1 text-xs uppercase tracking-wide opacity-70">{severity}</div>
    </div>
  );
}

function SmallTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Array<Record<string, any>>;
  columns: string[];
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-stone-900">{title}</h2>

      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-stone-100">
                  {columns.map((column) => (
                    <td key={column} className="px-3 py-2 text-stone-700">
                      {String(row[column] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Không có dữ liệu bất thường.
        </div>
      )}
    </section>
  );
}

export default async function ImportAuditPage({ params }: PageProps) {
  const { sessionId } = await params;
  const profile = await getProfile();
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await getSupabase();

  const [
    sessionRes,
    stagingCountsRes,
    suggestionCountsRes,
    activeUnknownRes,
    orphanEventsRes,
    duplicatePersonEventsRes,
    eventsWithoutPersonEventRes,
    emptyFamiliesRes,
    mergeEventsRes,
    committedSuggestionsRes,
  ] = await Promise.all([
    supabase
      .from("import_sessions")
      .select("id, file_name, status, summary, created_at, committed_at")
      .eq("id", sessionId)
      .maybeSingle(),

    supabase.rpc("count_import_staging_records_by_session", {
      p_session_id: sessionId,
    }),

    supabase.rpc("count_import_merge_suggestions_by_session", {
      p_session_id: sessionId,
    }),

    supabase
      .from("persons")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("full_name", ["Unknown", "Chưa rõ tên"]),

    supabase.rpc("count_orphan_active_events"),

    supabase.rpc("count_duplicate_birth_death_events"),

    supabase.rpc("count_events_without_person_events"),

    supabase.rpc("count_active_empty_families"),

    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("legacy_source", "gedcom.merge"),

    supabase
      .from("import_merge_suggestions")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("status", "committed"),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-bold text-red-700">
          Không tải được import session
        </h1>
        <pre className="mt-4 overflow-auto rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {JSON.stringify(
            {
              sessionId,
              error: sessionRes.error,
              data: sessionRes.data,
            },
            null,
            2,
          )}
        </pre>
      </div>
    );
  }

  const audit = buildImportAuditResult({
    activeUnknownPersons: activeUnknownRes.count ?? 0,
    orphanEvents: ((orphanEventsRes.data as CountRow | null)?.count ?? 0),
    duplicatePersonEvents:
      ((duplicatePersonEventsRes.data as CountRow | null)?.count ?? 0),
    eventsWithoutPersonEvent:
      ((eventsWithoutPersonEventRes.data as CountRow | null)?.count ?? 0),
    activeEmptyFamilies: ((emptyFamiliesRes.data as CountRow | null)?.count ?? 0),
    mergeEvents: mergeEventsRes.count ?? 0,
    committedMergeSuggestions: committedSuggestionsRes.count ?? 0,
  });

  const stagingRows = ((stagingCountsRes.data ?? []) as GroupCountRow[]).map(
    (row) => ({
      record_type: row.record_type,
      action: row.action,
      status: row.status,
      count: row.count,
    }),
  );

  const suggestionRows = ((suggestionCountsRes.data ?? []) as GroupCountRow[]).map(
    (row) => ({
      suggestion_type: row.suggestion_type,
      status: row.status,
      count: row.count,
    }),
  );

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Link
          href={`/dashboard/import/${sessionId}`}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="size-4" />
          Quay lại import preview
        </Link>

        <h1 className="title">GEDCOM import audit</h1>
        <p className="mt-1 text-sm text-stone-500">
          Kiểm tra dữ liệu sau staging/import/merge. File:{" "}
          <span className="font-semibold">{sessionRes.data.file_name ?? "—"}</span>
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <section
          className={`rounded-2xl border p-5 shadow-sm ${
            audit.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 size-6 shrink-0" />
            <div>
              <h2 className="font-bold">
                {audit.ok ? "Audit không có lỗi chặn" : "Audit có lỗi cần xử lý"}
              </h2>
              <p className="mt-1 text-sm opacity-80">
                Trang này chỉ đọc dữ liệu. Không sửa DB.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audit.counts.map((item) => (
            <AuditCard
              key={item.label}
              label={item.label}
              count={item.count}
              severity={item.severity}
            />
          ))}
        </section>

        {[
          stagingCountsRes.error,
          suggestionCountsRes.error,
          orphanEventsRes.error,
          duplicatePersonEventsRes.error,
          eventsWithoutPersonEventRes.error,
          emptyFamiliesRes.error,
        ].some(Boolean) ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Một số RPC audit chưa tồn tại. Hãy chạy migration tạo audit RPCs ở bước tiếp theo.
          </section>
        ) : null}

        <SmallTable
          title="Staging records"
          rows={stagingRows}
          columns={["record_type", "action", "status", "count"]}
        />

        <SmallTable
          title="Merge suggestions"
          rows={suggestionRows}
          columns={["suggestion_type", "status", "count"]}
        />
      </main>
    </div>
  );
}
