import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Database, FileText, Search, GitCompareArrows } from "lucide-react";
import { getSupabase } from "@/utils/supabase/queries";
import {
  StagingRecordActions,
  StagingSessionBulkActions,
} from "@/components/ImportStagingRecordActions";
import GedcomCommitPlanPanel from "@/components/GedcomCommitPlanPanel";
import GedcomRoundTripReport from "@/components/GedcomRoundTripReport";
import GedcomCommitExecutePanel from "@/components/GedcomCommitExecutePanel";

export const metadata = {
  title: "GEDCOM staging preview",
};

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

type StagingRecord = {
  id: string;
  session_id: string;
  record_type: string;
  external_id: string | null;
  parent_external_id: string | null;
  action: string;
  confidence: string;
  status: string;
  payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  sort_order: number | null;
  created_at: string;
};

type ImportSession = {
  id: string;
  source_type: string;
  file_name: string | null;
  file_size: number | null;
  file_hash: string | null;
  status: string;
  summary: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  created_at: string;
  committed_at: string | null;
};

const recordTypeLabels: Record<string, string> = {
  person: "Persons",
  name: "Names",
  family: "Families",
  family_parent: "Family parents",
  family_child: "Family children",
  event: "Events",
  person_event: "Person events",
  note: "Notes",
  source: "Sources",
  media: "Media",
  warning: "Warnings",
  unknown: "Unknown",
};

const actionClass: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-blue-100 text-blue-700",
  match: "bg-indigo-100 text-indigo-700",
  skip: "bg-stone-100 text-stone-600",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
};

const confidenceClass: Record<string, string> = {
  certain: "bg-emerald-100 text-emerald-700",
  review: "bg-amber-100 text-amber-700",
  low: "bg-orange-100 text-orange-700",
  manual: "bg-stone-100 text-stone-600",
};

const statusClass: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  skipped: "bg-stone-100 text-stone-600",
  rejected: "bg-red-100 text-red-700",
  committed: "bg-blue-100 text-blue-700",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Không rõ";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getMainPreview(record: StagingRecord): Array<[string, unknown]> {
  const p = record.normalized_payload ?? {};

  if (record.record_type === "person") {
    return [
      ["Tên", p.full_name],
      ["Giới tính", p.gender],
      ["Sinh", [p.birth_day, p.birth_month, p.birth_year].filter(Boolean).join("-")],
      ["Mất", [p.death_day, p.death_month, p.death_year].filter(Boolean).join("-")],
      ["Đã mất", p.is_deceased],
    ];
  }

  if (record.record_type === "name") {
    return [
      ["Person external ID", p.person_external_id],
      ["Tên", p.full_name],
      ["Primary", p.is_primary],
      ["Loại tên", p.name_type],
    ];
  }

  if (record.record_type === "family") {
    return [
      ["Family external ID", p.external_id],
      ["Status", p.status],
    ];
  }

  if (record.record_type === "family_parent") {
    return [
      ["Family external ID", p.family_external_id],
      ["Person external ID", p.person_external_id],
      ["Role", p.role],
      ["Sort order", p.sort_order],
    ];
  }

  if (record.record_type === "family_child") {
    return [
      ["Family external ID", p.family_external_id],
      ["Person external ID", p.person_external_id],
      ["Relationship type", p.relationship_type],
    ];
  }

  if (record.record_type === "event") {
    return [
      ["Type", p.type],
      ["Person external ID", p.legacy_person_external_id],
      ["Start", p.start_date],
      ["End", p.end_date],
      ["Sort", p.sort_date],
      ["Precision", p.date_precision],
      ["Lunar", [p.lunar_day, p.lunar_month, p.lunar_year].filter(Boolean).join("/")],
    ];
  }

  if (record.record_type === "person_event") {
    return [
      ["Person external ID", p.person_external_id],
      ["Event external ID", p.event_external_id],
      ["Role", p.role],
    ];
  }

  return Object.entries(p).slice(0, 8);
}

function groupRecords(records: StagingRecord[]) {
  const out = new Map<string, StagingRecord[]>();

  for (const record of records) {
    const arr = out.get(record.record_type) ?? [];
    arr.push(record);
    out.set(record.record_type, arr);
  }

  return out;
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-stone-900">
        {getDisplayValue(value)}
      </div>
    </div>
  );
}
function RecordCard({
  record,
  sessionId,
}: {
  record: StagingRecord;
  sessionId: string;
}) {
  const main = getMainPreview(record).filter(([, value]) => {
    return value !== null && value !== undefined && value !== "";
  });

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-stone-900">
            {record.external_id || record.id}
          </div>
          {record.parent_external_id ? (
            <div className="mt-0.5 text-xs text-stone-400">
              Parent: {record.parent_external_id}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className={actionClass[record.action] ?? "bg-stone-100 text-stone-600"}>
            {record.action}
          </Badge>
          <Badge
            className={
              confidenceClass[record.confidence] ?? "bg-stone-100 text-stone-600"
            }
          >
            {record.confidence}
          </Badge>
          <Badge className={statusClass[record.status] ?? "bg-stone-100 text-stone-600"}>
            {record.status}
          </Badge>
        </div>
      </div>

      {main.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {main.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2"
            >
              <div className="text-xs text-stone-400">{key}</div>
              <div className="mt-0.5 text-sm font-medium text-stone-800">
                {getDisplayValue(value)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {record.warnings && record.warnings.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="font-semibold">Warnings</div>
          <ul className="mt-1 list-inside list-disc">
            {record.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {record.errors && record.errors.length > 0 ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-semibold">Errors</div>
          <ul className="mt-1 list-inside list-disc">
            {record.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-stone-500 hover:text-stone-700">
          Xem JSON payload
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-stone-950 p-3 text-xs text-stone-100">
          {JSON.stringify(
            {
              payload: record.payload,
              normalized_payload: record.normalized_payload,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <StagingRecordActions
        sessionId={sessionId}
        recordId={record.id}
        recordType={record.record_type}
        currentAction={record.action}
        currentStatus={record.status as any}
      />
    </div>
  );
}

export default async function ImportSessionPreviewPage({ params }: PageProps) {
  const { sessionId } = await params;
  const supabase = await getSupabase();

  const [sessionRes, recordsRes] = await Promise.all([
    supabase
      .from("import_sessions")
      .select("*")
      .eq("id", sessionId)
      .single(),
    supabase
      .from("import_staging_records")
      .select("*")
      .eq("session_id", sessionId)
      .order("sort_order", { ascending: true }),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    notFound();
  }

  const session = sessionRes.data as ImportSession;
  const records = (recordsRes.data ?? []) as StagingRecord[];
  const grouped = groupRecords(records);

  const orderedTypes = [
    "person",
    "name",
    "family",
    "family_parent",
    "family_child",
    "event",
    "person_event",
    "warning",
    "unknown",
  ].filter((type) => grouped.has(type));

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Link
          href="/dashboard/import"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="size-4" />
          Quay lại upload
        </Link>

        <h1 className="title">GEDCOM staging preview</h1>
        <p className="mt-1 text-sm text-stone-500">
          Xem trước dữ liệu đã parse từ GEDCOM. Trang này chưa commit vào dữ liệu chính.
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-5" />
            Preview-only mode
          </div>
          <p className="mt-2">
            Dữ liệu bên dưới chỉ nằm trong import_sessions và import_staging_records.
            Chưa ghi vào persons, person_names, families, events hoặc person_events.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="File" value={session.file_name ?? "—"} />
          <SummaryCard label="Dung lượng" value={formatFileSize(session.file_size)} />
          <SummaryCard label="Status" value={session.status} />
          <SummaryCard label="Records" value={records.length} />
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Database className="size-5 text-stone-500" />
            <h2 className="text-lg font-bold text-stone-900">Tổng quan parse</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(session.summary ?? {}).map(([key, value]) => (
              <div key={key} className="rounded-xl bg-stone-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-stone-400">
                  {key}
                </div>
                <div className="mt-1 text-xl font-bold text-stone-900">
                  {getDisplayValue(value)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-xs text-stone-500">
            Hash: <span className="font-mono">{session.file_hash ?? "—"}</span>
          </div>
        </section>
        <GedcomRoundTripReport
          sessionId={session.id}
          summary={session.summary as any}
          records={records as any}
        />

        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="font-bold">Duyệt GEDCOM staging</div>
              <p className="mt-1">
                Mở Match Review để so sánh person trùng/nghi trùng, hoặc mở Merge Plan để xem dữ liệu có thể bổ sung cho matched persons.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard/import/${session.id}/matches`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
              >
                <Search className="size-4" />
                Mở Match Review
              </Link>

              <Link
                href={`/dashboard/import/${session.id}/merge`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
              >
                <GitCompareArrows className="size-4" />
                Mở Merge Plan
              </Link>
            </div>
          </div>
        </section>

        <StagingSessionBulkActions sessionId={session.id} />
        <GedcomCommitPlanPanel sessionId={session.id} />
        <GedcomCommitExecutePanel sessionId={session.id} />
        {recordsRes.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            <div className="font-bold">Không tải được staging records</div>
            <div className="mt-1 text-sm">{recordsRes.error.message}</div>
          </section>
        ) : null}

        {orderedTypes.length === 0 ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
            Session này chưa có staging records.
          </section>
        ) : (
          orderedTypes.map((type) => {
            const items = grouped.get(type) ?? [];

            return (
              <section
                key={type}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-stone-500" />
                    <h2 className="text-lg font-bold text-stone-900">
                      {recordTypeLabels[type] ?? type}
                    </h2>
                  </div>

                  <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-stone-700">
                    {items.length}
                  </span>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {items.map((record) => (
                    <RecordCard key={record.id} record={record} sessionId={session.id} />
                  ))}
                </div>
              </section>
            );
          })
        )}

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900">Bước tiếp theo</h2>
          <p className="mt-2 text-sm text-stone-500">
            Nếu preview đúng, bước sau mới tạo chức năng approve/skip và commit
            staging vào schema thật. Chưa dùng importData legacy cho GEDCOM staging.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" />
            An toàn: trang này không có server action ghi vào dữ liệu chính.
          </div>
        </section>
      </main>
    </div>
  );
}