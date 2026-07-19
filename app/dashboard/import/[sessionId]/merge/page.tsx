import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FilePlus2,
  Info,
  TriangleAlert,
} from "lucide-react";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import {
  buildGedcomMergePlan,
  type MergePlanRecord,
} from "@/services/import/gedcomMergePlan.service";
import {
  BulkApproveMergeSuggestionsButton,
  CommitApprovedMergeSuggestionsButton,
  GenerateMergeSuggestionsButton,
  MergeSuggestionStatusActions,
} from "@/components/GedcomMergeSuggestionActions";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

type ImportSession = {
  id: string;
  file_name: string | null;
  status: string;
  summary: Record<string, any> | null;
};

type MergeSuggestionRow = {
  id: string;
  suggestion_type: string;
  status: string;
  matched_person_id: string | null;
  matched_person_name: string | null;
  source_external_id: string | null;
  payload: Record<string, any> | null;
  reason: string | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return value;
}

function statusClass(status: MergePlanRecord["status"]) {
  if (status === "can_create") return "bg-indigo-100 text-indigo-700";
  if (status === "already_exists") return "bg-emerald-100 text-emerald-700";
  if (status === "missing_date") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function suggestionStatusClass(status: string) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "skipped") return "bg-stone-200 text-stone-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  if (status === "committed") return "bg-indigo-100 text-indigo-700";
  return "bg-stone-100 text-stone-700";
}

function SummaryCard({
  label,
  value,
  tone = "stone",
}: {
  label: string;
  value: number;
  tone?: "stone" | "emerald" | "amber" | "red" | "indigo";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "red"
          ? "border-red-200 bg-red-50 text-red-800"
          : tone === "indigo"
            ? "border-indigo-200 bg-indigo-50 text-indigo-800"
            : "border-stone-200 bg-white text-stone-800";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="text-sm opacity-75">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}

function MergeRecordCard({ record }: { record: MergePlanRecord }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusClass(
                record.status,
              )}`}
            >
              {record.status}
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-700">
              {record.type}
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-700">
              {record.datePrecision ?? "unknown"}
            </span>
          </div>

          <div className="mt-2 font-bold text-stone-900">
            {record.matchedPersonName || "Không rõ matched person"}
          </div>

          <div className="mt-1 text-sm text-stone-500">{record.reason}</div>
        </div>

        <div className="grid gap-1 text-sm text-stone-600 sm:grid-cols-2 lg:min-w-[460px]">
          <div>
            <span className="text-stone-400">Start:</span>{" "}
            {formatDate(record.startDate)}
          </div>
          <div>
            <span className="text-stone-400">End:</span>{" "}
            {formatDate(record.endDate)}
          </div>
          <div>
            <span className="text-stone-400">Sort:</span>{" "}
            {formatDate(record.sortDate)}
          </div>
          <div className="font-mono text-xs">
            <span className="text-stone-400">Person:</span>{" "}
            {record.matchedPersonId || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  sessionId,
}: {
  suggestion: MergeSuggestionRow;
  sessionId: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
              {suggestion.suggestion_type}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${suggestionStatusClass(
                suggestion.status,
              )}`}
            >
              {suggestion.status}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-700">
              {suggestion.payload?.type ?? "event"}
            </span>
          </div>

          <div className="mt-2 font-bold text-stone-900">
            {suggestion.matched_person_name ??
              suggestion.matched_person_id ??
              "Không rõ matched person"}
          </div>

          <div className="mt-1 text-sm text-stone-500">
            {suggestion.reason ?? "—"}
          </div>

          <div className="mt-2 grid gap-1 text-sm text-stone-600 sm:grid-cols-3">
            <div>Start: {suggestion.payload?.start_date ?? "—"}</div>
            <div>End: {suggestion.payload?.end_date ?? "—"}</div>
            <div>Sort: {suggestion.payload?.sort_date ?? "—"}</div>
          </div>

          <div className="mt-2 font-mono text-xs text-stone-400">
            Source: {suggestion.source_external_id ?? "—"}
          </div>
        </div>

        <MergeSuggestionStatusActions
          sessionId={sessionId}
          suggestionId={suggestion.id}
          currentStatus={suggestion.status}
        />
      </div>
    </div>
  );
}

export default async function GedcomMergePlanPage({ params }: PageProps) {
  const { sessionId } = await params;
  const profile = await getProfile();
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await getSupabase();

  const [sessionRes, recordsRes, eventsRes, suggestionsRes] = await Promise.all([
    supabase
      .from("import_sessions")
      .select("id, file_name, status, summary")
      .eq("id", sessionId)
      .maybeSingle(),

    supabase
      .from("import_staging_records")
      .select(
        "id, record_type, external_id, parent_external_id, action, status, normalized_payload",
      )
      .eq("session_id", sessionId)
      .in("record_type", ["person", "event"])
      .order("sort_order", { ascending: true }),

    supabase
      .from("events")
      .select(
        "id, type, legacy_person_id, start_date, end_date, sort_date, deleted_at",
      ),

    supabase
      .from("import_merge_suggestions")
      .select(
        "id, suggestion_type, status, matched_person_id, matched_person_name, source_external_id, payload, reason, created_at",
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false }),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-bold text-red-700">
          Không tải được import session
        </h1>

        <p className="mt-2 text-sm text-stone-600">
          Route /merge đã chạy, nhưng query import_sessions trả lỗi hoặc không
          có data.
        </p>

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

  const session = sessionRes.data as ImportSession;

  const plan = buildGedcomMergePlan({
    records: (recordsRes.data ?? []) as any,
    existingEvents: (eventsRes.data ?? []) as any,
  });

  const suggestions = (suggestionsRes.data ?? []) as MergeSuggestionRow[];

  const canCreate = plan.records.filter(
    (record) => record.status === "can_create",
  );
  const alreadyExists = plan.records.filter(
    (record) => record.status === "already_exists",
  );
  const missingDate = plan.records.filter(
    (record) => record.status === "missing_date",
  );
  const invalid = plan.records.filter((record) => record.status === "invalid");

  const suggestionCounts = {
    total: suggestions.length,
    pending: suggestions.filter((item) => item.status === "pending").length,
    approved: suggestions.filter((item) => item.status === "approved").length,
    skipped: suggestions.filter((item) => item.status === "skipped").length,
    rejected: suggestions.filter((item) => item.status === "rejected").length,
    committed: suggestions.filter((item) => item.status === "committed").length,
  };

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Link
          href={`/dashboard/import/${sessionId}`}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="size-4" />
          Quay lại preview
        </Link>

        <h1 className="title">GEDCOM merge plan</h1>
        <p className="mt-1 text-sm text-stone-500">
          Preview-only. Phân tích dữ liệu GEDCOM có thể bổ sung vào matched
          persons. File:{" "}
          <span className="font-semibold">{session.file_name ?? "—"}</span>
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sky-900">
          <div className="flex gap-3">
            <Info className="mt-0.5 size-6 shrink-0 text-sky-600" />
            <div>
              <h2 className="font-bold">Chế độ preview-only</h2>
              <p className="mt-1 text-sm text-sky-800">
                Trang này chưa ghi dữ liệu. Nó chỉ cho biết event birth/death
                nào từ GEDCOM có thể bổ sung cho person đã match. Bảng merge
                suggestions cũng chỉ là lớp review, chưa ghi vào events.
              </p>
            </div>
          </div>
        </section>

        {recordsRes.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            <div className="font-bold">Không tải được staging records</div>
            <div className="mt-1 text-sm">{recordsRes.error.message}</div>
          </section>
        ) : null}

        {eventsRes.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            <div className="font-bold">Không tải được events hiện có</div>
            <div className="mt-1 text-sm">{eventsRes.error.message}</div>
          </section>
        ) : null}

        {suggestionsRes.error ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
            <div className="font-bold">Chưa tải được merge suggestions</div>
            <div className="mt-1 text-sm">
              {suggestionsRes.error.message}
            </div>
            <p className="mt-2 text-sm">
              Nếu đây là lần đầu làm bước này, hãy kiểm tra đã chạy migration{" "}
              <span className="font-mono">
                024_gedcom_merge_suggestions_v234.sql
              </span>{" "}
              trong Supabase chưa.
            </p>
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            label="Matched persons"
            value={plan.summary.matchedPersons}
            tone="emerald"
          />
          <SummaryCard
            label="Skipped events"
            value={plan.summary.skippedEvents}
            tone="stone"
          />
          <SummaryCard
            label="Can create"
            value={plan.summary.canCreate}
            tone="indigo"
          />
          <SummaryCard
            label="Already exists"
            value={plan.summary.alreadyExists}
            tone="emerald"
          />
          <SummaryCard
            label="Invalid"
            value={plan.summary.invalid}
            tone={plan.summary.invalid > 0 ? "red" : "stone"}
          />
        </section>

        <GenerateMergeSuggestionsButton sessionId={sessionId} />

        {suggestions.length > 0 ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-stone-900">
                  Merge suggestions đã tạo
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Đây vẫn là review layer. Approved suggestions chưa ghi vào
                  events cho đến bước commit merge sau này.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
  <BulkApproveMergeSuggestionsButton sessionId={sessionId} />
  <CommitApprovedMergeSuggestionsButton
    sessionId={sessionId}
    approvedCount={suggestionCounts.approved}
  />
</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <SummaryCard
                label="Suggestions"
                value={suggestionCounts.total}
                tone="stone"
              />
              <SummaryCard
                label="Pending"
                value={suggestionCounts.pending}
                tone="amber"
              />
              <SummaryCard
                label="Approved"
                value={suggestionCounts.approved}
                tone="emerald"
              />
              <SummaryCard
                label="Skipped"
                value={suggestionCounts.skipped}
                tone="stone"
              />
              <SummaryCard
                label="Rejected"
                value={suggestionCounts.rejected}
                tone="red"
              />
              <SummaryCard
                label="Committed"
                value={suggestionCounts.committed}
                tone="indigo"
              />
            </div>

            <div className="mt-4 space-y-3">
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  sessionId={sessionId}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-500 shadow-sm">
            Chưa có merge suggestion nào được tạo cho session này.
          </section>
        )}

        {invalid.length > 0 ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            <div className="flex items-center gap-2 font-bold">
              <TriangleAlert className="size-5" />
              Có invalid merge records
            </div>
            <p className="mt-1 text-sm">
              Chưa làm merge thật khi còn invalid records.
            </p>

            <div className="mt-4 space-y-3">
              {invalid.slice(0, 50).map((record) => (
                <MergeRecordCard
                  key={`${record.eventExternalId}:${record.matchedPersonId}`}
                  record={record}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FilePlus2 className="size-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-stone-900">
              Có thể bổ sung
            </h2>
          </div>

          {canCreate.length > 0 ? (
            canCreate.map((record) => (
              <MergeRecordCard
                key={`${record.eventExternalId}:${record.matchedPersonId}`}
                record={record}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
              Không có event mới cần bổ sung.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-stone-900">
              Đã có trong DB
            </h2>
          </div>

          {alreadyExists.length > 0 ? (
            alreadyExists.slice(0, 100).map((record) => (
              <MergeRecordCard
                key={`${record.eventExternalId}:${record.matchedPersonId}`}
                record={record}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-500">
              Chưa có record already_exists.
            </div>
          )}

          {alreadyExists.length > 100 ? (
            <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-500">
              Đang hiển thị 100/{alreadyExists.length} records đầu tiên.
            </div>
          ) : null}
        </section>

        {missingDate.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-stone-900">
              Thiếu ngày, chưa merge
            </h2>
            {missingDate.slice(0, 50).map((record) => (
              <MergeRecordCard
                key={`${record.eventExternalId}:${record.matchedPersonId}`}
                record={record}
              />
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}