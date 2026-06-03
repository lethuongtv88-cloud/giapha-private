import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, Search, UserPlus } from "lucide-react";
import { getSupabase } from "@/utils/supabase/queries";
import { StagingRecordActions } from "@/components/ImportStagingRecordActions";
import ImportMatchReviewBulkActions from "@/components/ImportMatchReviewBulkActions";

export const metadata = {
  title: "GEDCOM match review",
};

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

type MatchRecord = {
  id: string;
  session_id: string;
  record_type: string;
  external_id: string | null;
  action: string;
  status: string;
  confidence: string;
  normalized_payload: Record<string, any>;
  warnings: string[];
  errors: string[];
  sort_order: number | null;
};

type ImportSession = {
  id: string;
  file_name: string | null;
  status: string;
  summary: Record<string, any> | null;
  created_at: string;
};

type ExistingPerson = {
  id: string;
  full_name: string;
  gender: string | null;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
};

function getText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function formatDateParts(input: {
  year?: unknown;
  month?: unknown;
  day?: unknown;
}) {
  const year = input.year ? String(input.year) : "";
  const month = input.month ? String(input.month).padStart(2, "0") : "";
  const day = input.day ? String(input.day).padStart(2, "0") : "";

  if (year && month && day) return `${day}-${month}-${year}`;
  if (year && month) return `${month}-${year}`;
  if (year) return year;
  return "—";
}

function groupRecords(records: MatchRecord[]) {
  const strongMatches = records.filter(
    (record) =>
      record.action === "match" &&
      record.status === "skipped" &&
      record.normalized_payload?.match_level === "strong",
  );

  const possibleMatches = records.filter(
    (record) => record.action === "match" && record.status === "pending",
  );

  const createCandidates = records.filter(
    (record) => record.action === "create" && record.status === "pending",
  );

  const unknownCandidates = createCandidates.filter((record) => {
    const name = record.normalized_payload?.full_name;
    return name === "Unknown" || name === "Chưa rõ tên" || !name;
  });

  return {
    strongMatches,
    possibleMatches,
    createCandidates,
    unknownCandidates,
  };
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

function ExistingPersonBox({ person }: { person: ExistingPerson | null }) {
  if (!person) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
        Không tìm thấy person hiện có.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
        Person hiện có trong DB
      </div>
      <div className="mt-1 font-bold text-emerald-900">{person.full_name}</div>
      <div className="mt-2 grid gap-1 text-sm text-emerald-800 sm:grid-cols-2">
        <div>Giới tính: {getText(person.gender)}</div>
        <div>
          Sinh:{" "}
          {formatDateParts({
            year: person.birth_year,
            month: person.birth_month,
            day: person.birth_day,
          })}
        </div>
        <div>
          Mất:{" "}
          {formatDateParts({
            year: person.death_year,
            month: person.death_month,
            day: person.death_day,
          })}
        </div>
        <div className="font-mono text-xs">ID: {person.id}</div>
      </div>
    </div>
  );
}

function GedcomPersonBox({ record }: { record: MatchRecord }) {
  const p = record.normalized_payload;

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-sky-600">
        Person trong GEDCOM
      </div>
      <div className="mt-1 font-bold text-sky-900">{getText(p.full_name)}</div>
      <div className="mt-2 grid gap-1 text-sm text-sky-800 sm:grid-cols-2">
        <div>Giới tính: {getText(p.gender)}</div>
        <div>
          Sinh:{" "}
          {formatDateParts({
            year: p.birth_year,
            month: p.birth_month,
            day: p.birth_day,
          })}
        </div>
        <div>
          Mất:{" "}
          {formatDateParts({
            year: p.death_year,
            month: p.death_month,
            day: p.death_day,
          })}
        </div>
        <div className="font-mono text-xs">GEDCOM: {record.external_id}</div>
      </div>
    </div>
  );
}

function MatchCard({
  record,
  existingPerson,
  sessionId,
}: {
  record: MatchRecord;
  existingPerson: ExistingPerson | null;
  sessionId: string;
}) {
  const p = record.normalized_payload;
  const score = p.match_score ?? "—";
  const level = p.match_level ?? "none";
  const reason = p.match_reason ?? "—";

  const isPossible = record.action === "match" && record.status === "pending";
  const isCreate = record.action === "create";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                isPossible
                  ? "bg-amber-100 text-amber-700"
                  : isCreate
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {record.action}/{record.status}
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-700">
              {level}
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-700">
              score {score}
            </span>
          </div>

          <div className="mt-2 text-sm text-stone-500">{reason}</div>
        </div>

        <StagingRecordActions
          sessionId={sessionId}
          recordId={record.id}
          recordType={record.record_type}
          currentAction={record.action}
          currentStatus={record.status as any}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <GedcomPersonBox record={record} />
        <ExistingPersonBox person={existingPerson} />
      </div>

      {record.warnings && record.warnings.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="font-semibold">Warnings</div>
          <ul className="mt-1 list-inside list-disc">
            {record.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  records,
  existingPersonsById,
  sessionId,
}: {
  title: string;
  description: string;
  records: MatchRecord[];
  existingPersonsById: Map<string, ExistingPerson>;
  sessionId: string;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <p className="mt-1 text-sm text-stone-500">{description}</p>
        </div>

        <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-stone-700">
          {records.length}
        </span>
      </div>

      {records.length > 0 ? (
        <div className="space-y-3">
          {records.map((record) => {
            const matchedPersonId = record.normalized_payload?.matched_person_id;
            const existingPerson =
              typeof matchedPersonId === "string"
                ? existingPersonsById.get(matchedPersonId) ?? null
                : null;

            return (
              <MatchCard
                key={record.id}
                record={record}
                existingPerson={existingPerson}
                sessionId={sessionId}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          Không có record trong nhóm này.
        </div>
      )}
    </section>
  );
}

export default async function ImportMatchReviewPage({ params }: PageProps) {
  const { sessionId } = await params;
  const supabase = await getSupabase();

  const [sessionRes, recordsRes] = await Promise.all([
    supabase
      .from("import_sessions")
      .select("id, file_name, status, summary, created_at")
      .eq("id", sessionId)
      .single(),
    supabase
      .from("import_staging_records")
      .select(
        "id, session_id, record_type, external_id, action, status, confidence, normalized_payload, warnings, errors, sort_order",
      )
      .eq("session_id", sessionId)
      .eq("record_type", "person")
      .order("sort_order", { ascending: true }),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    notFound();
  }

  const session = sessionRes.data as ImportSession;
  const records = (recordsRes.data ?? []) as MatchRecord[];
  const grouped = groupRecords(records);

  const matchedPersonIds = Array.from(
    new Set(
      records
        .map((record) => record.normalized_payload?.matched_person_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  let existingPersons: ExistingPerson[] = [];

  if (matchedPersonIds.length > 0) {
    const { data } = await supabase
      .from("persons")
      .select(
        "id, full_name, gender, birth_year, birth_month, birth_day, death_year, death_month, death_day",
      )
      .in("id", matchedPersonIds);

    existingPersons = (data ?? []) as ExistingPerson[];
  }

  const existingPersonsById = new Map(
    existingPersons.map((person) => [person.id, person]),
  );

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

        <h1 className="title">GEDCOM match review</h1>
        <p className="mt-1 text-sm text-stone-500">
          Duyệt người trùng/nghi trùng trước khi import. File:{" "}
          <span className="font-semibold">{session.file_name ?? "—"}</span>
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-5" />
            Không commit file full khi còn possible matches chưa duyệt
          </div>
          <p className="mt-2">
            Record match/pending là nghi trùng. Nếu đúng là trùng, giữ nguyên
            hoặc skip. Nếu không phải trùng, dùng nút “Tạo mới dù nghi trùng”.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Strong matches"
            value={grouped.strongMatches.length}
            tone="emerald"
          />
          <SummaryCard
            label="Possible matches"
            value={grouped.possibleMatches.length}
            tone="amber"
          />
          <SummaryCard
            label="Create candidates"
            value={grouped.createCandidates.length}
            tone="indigo"
          />
          <SummaryCard
            label="Unknown"
            value={grouped.unknownCandidates.length}
            tone="red"
          />
        </section>

        <ImportMatchReviewBulkActions
          sessionId={sessionId}
          possibleMatches={grouped.possibleMatches.length}
        />

        <Section
          title="Possible matches cần review"
          description="Đây là nhóm quan trọng nhất. Không approve hàng loạt khi nhóm này còn nhiều."
          records={grouped.possibleMatches}
          existingPersonsById={existingPersonsById}
          sessionId={sessionId}
        />

        <Section
          title="Create candidates"
          description="Những người chưa tìm thấy match đủ tin cậy. Kiểm tra kỹ trước khi approve."
          records={grouped.createCandidates}
          existingPersonsById={existingPersonsById}
          sessionId={sessionId}
        />

        <Section
          title="Strong matches đã skip"
          description="Đã nhận diện trùng chắc và đang được bỏ qua để tránh tạo duplicate."
          records={grouped.strongMatches}
          existingPersonsById={existingPersonsById}
          sessionId={sessionId}
        />
      </main>
    </div>
  );
}
