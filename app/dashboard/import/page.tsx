import { redirect } from "next/navigation";
import Link from "next/link";
import GedcomStagingUploader from "@/components/GedcomStagingUploader";
import ImportSessionActions from "@/components/ImportSessionActions";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { Eye, FileText } from "lucide-react";

export const metadata = {
  title: "Import GEDCOM staging",
};

type ImportSessionRow = {
  id: string;
  source_type: string;
  file_name: string | null;
  file_size: number | null;
  status: string;
  summary: Record<string, unknown> | null;
  created_at: string;
  committed_at: string | null;
};

const statusClass: Record<string, string> = {
  uploaded: "bg-stone-100 text-stone-700",
  parsed: "bg-sky-100 text-sky-700",
  reviewing: "bg-amber-100 text-amber-700",
  ready_to_commit: "bg-indigo-100 text-indigo-700",
  committing: "bg-purple-100 text-purple-700",
  committed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-stone-200 text-stone-600",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(input: string | null): string {
  if (!input) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(input));
}

function getSummaryNumber(
  summary: Record<string, unknown> | null,
  key: string,
): number {
  const value = summary?.[key];

  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  if (
    key in ((summary?.committed ?? {}) as Record<string, unknown>) &&
    typeof (summary?.committed as Record<string, unknown>)?.[key] === "number"
  ) {
    return (summary?.committed as Record<string, number>)[key] ?? 0;
  }

  return 0;
}

function SessionCard({ session }: { session: ImportSessionRow }) {
  const statusTone = statusClass[session.status] ?? "bg-stone-100 text-stone-700";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="size-5 text-stone-500" />
            <h3 className="font-bold text-stone-900">
              {session.file_name ?? "Không rõ tên file"}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone}`}
            >
              {session.status}
            </span>
          </div>

          <div className="mt-2 grid gap-1 text-sm text-stone-500 sm:grid-cols-2">
            <div>Size: {formatFileSize(session.file_size)}</div>
            <div>Tạo: {formatDate(session.created_at)}</div>
            <div>Committed: {formatDate(session.committed_at)}</div>
            <div className="font-mono text-xs">ID: {session.id}</div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Summary label="Persons" value={getSummaryNumber(session.summary, "persons")} />
            <Summary label="Families" value={getSummaryNumber(session.summary, "families")} />
            <Summary label="Events" value={getSummaryNumber(session.summary, "events")} />
            <Summary label="Matches" value={getSummaryNumber(session.summary, "matches")} />
            <Summary label="Errors" value={getSummaryNumber(session.summary, "errors")} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3">
          <Link
            href={`/dashboard/import/${session.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            <Eye className="size-4" />
            Mở preview
          </Link>

          <ImportSessionActions sessionId={session.id} status={session.status} />
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <div className="text-xs text-stone-400">{label}</div>
      <div className="text-lg font-bold text-stone-900">{value}</div>
    </div>
  );
}

export default async function ImportPage() {
  const profile = await getProfile();
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("import_sessions")
    .select(
      "id, source_type, file_name, file_size, status, summary, created_at, committed_at",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const sessions = (data ?? []) as ImportSessionRow[];

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <h1 className="title">Import GEDCOM staging</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Upload GEDCOM để parse vào staging/preview. Bước này chưa ghi vào dữ
          liệu chính cho đến khi bạn duyệt và commit.
        </p>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-8">
        <GedcomStagingUploader />

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900">
              Import sessions gần đây
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Quản lý các lần upload GEDCOM staging. Có thể mở lại preview, hủy
              hoặc xóa session chưa committed.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              Không tải được import sessions: {error.message}
            </div>
          ) : sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-6 text-sm text-stone-500">
              Chưa có import session nào.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}