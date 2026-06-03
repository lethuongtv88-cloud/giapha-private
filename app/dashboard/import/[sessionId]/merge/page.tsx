import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FilePlus2,
  Info,
  TriangleAlert,
} from "lucide-react";
import { getSupabase } from "@/utils/supabase/queries";
import {
  buildGedcomMergePlan,
  type MergePlanRecord,
} from "@/services/import/gedcomMergePlan.service";

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

          <div className="mt-1 text-sm text-stone-500">
            {record.reason}
          </div>
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

export default async function GedcomMergePlanPage({ params }: PageProps) {
  const { sessionId } = await params;
  const supabase = await getSupabase();

  const [sessionRes, recordsRes, eventsRes] = await Promise.all([
    supabase
      .from("import_sessions")
      .select("id, file_name, status, summary")
      .eq("id", sessionId)
      .single(),
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
      .select("id, type, legacy_person_id, start_date, end_date, sort_date, deleted_at"),
  ]);

if (sessionRes.error || !sessionRes.data) {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-bold text-red-700">
        Không tải được import session
      </h1>

      <p className="mt-2 text-sm text-stone-600">
        Route /merge đã chạy, nhưng query import_sessions trả lỗi hoặc không có data.
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

  const canCreate = plan.records.filter((record) => record.status === "can_create");
  const alreadyExists = plan.records.filter(
    (record) => record.status === "already_exists",
  );
  const missingDate = plan.records.filter(
    (record) => record.status === "missing_date",
  );
  const invalid = plan.records.filter((record) => record.status === "invalid");

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
                nào từ GEDCOM có thể bổ sung cho person đã match.
              </p>
            </div>
          </div>
        </section>

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

        {invalid.length > 0 ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            <div className="flex items-center gap-2 font-bold">
              <TriangleAlert className="size-5" />
              Có invalid merge records
            </div>
            <p className="mt-1 text-sm">
              Chưa làm merge thật khi còn invalid records.
            </p>
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
