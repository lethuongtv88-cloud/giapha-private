import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  FileWarning,
  GitPullRequestArrow,
  Link2Off,
  ShieldCheck,
  ShieldX,
  UsersRound,
} from "lucide-react";
import { AdminHealthShortcuts } from "@/components/AdminMaintenanceShortcuts";
import { getSupabase } from "@/utils/supabase/queries";
import {
  buildAdminHealthResult,
  type AdminHealthMetric,
  type HealthSeverity,
} from "@/services/admin-health/adminHealth.service";

export const metadata = {
  title: "Admin Health",
};

function severityClass(severity: HealthSeverity) {
  if (severity === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (severity === "error") return "border-red-200 bg-red-50 text-red-900";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-sky-200 bg-sky-50 text-sky-900";
}

function SeverityIcon({ severity }: { severity: HealthSeverity }) {
  if (severity === "ok") return <CheckCircle2 className="size-5 text-emerald-600" />;
  if (severity === "error") return <ShieldX className="size-5 text-red-600" />;
  if (severity === "warning") return <AlertTriangle className="size-5 text-amber-600" />;
  return <Activity className="size-5 text-sky-600" />;
}

function metricIcon(key: string) {
  if (key === "activeUnknownPersons") return <UsersRound className="size-6" />;
  if (key === "eventsMissingLinks") return <Link2Off className="size-6" />;
  if (key === "duplicateEventGroups") return <FileWarning className="size-6" />;
  if (key === "activeEmptyFamilies") return <DatabaseZap className="size-6" />;
  if (key === "openImportSessions") return <GitPullRequestArrow className="size-6" />;
  return <Activity className="size-6" />;
}

function MetricCard({ metric }: { metric: AdminHealthMetric }) {
  const card = (
    <div
      className={`h-full rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${severityClass(
        metric.severity,
      )}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">{metric.label}</h2>
          <p className="mt-1 text-sm opacity-75">{metric.description}</p>
        </div>

        <div className="rounded-xl bg-white/70 p-3">{metricIcon(metric.key)}</div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide opacity-60">Count</div>
          <div className="mt-1 text-4xl font-bold">{metric.value}</div>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-xs font-bold uppercase tracking-wide">
          <SeverityIcon severity={metric.severity} />
          {metric.severity}
        </div>
      </div>
    </div>
  );

  if (!metric.href) return card;

  return (
    <Link href={metric.href} className="block h-full">
      {card}
    </Link>
  );
}

export default async function AdminHealthPage() {
  const supabase = await getSupabase();

  const [
    unknownRes,
    missingLinksRes,
    emptyFamiliesRes,
    openImportSessionsRes,
    pendingSuggestionsRes,
    approvedSuggestionsRes,
    duplicateGroupsRes,
  ] = await Promise.all([
    supabase
      .from("persons")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("full_name", ["Unknown", "Chưa rõ tên"]),

    supabase.rpc("count_events_without_person_events"),

    supabase.rpc("count_active_empty_families"),

    supabase
      .from("import_sessions")
      .select("*", { count: "exact", head: true })
      .not("status", "in", "(committed,cancelled)"),

    supabase
      .from("import_merge_suggestions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),

    supabase
      .from("import_merge_suggestions")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved"),

    supabase.rpc("count_duplicate_birth_death_events"),
  ]);

  const health = buildAdminHealthResult({
    activeUnknownPersons: unknownRes.count ?? 0,
    eventsMissingLinks: toRpcCount(missingLinksRes.data),
    duplicateEventGroups: toRpcCount(duplicateGroupsRes.data),
    activeEmptyFamilies: toRpcCount(emptyFamiliesRes.data),
    openImportSessions: openImportSessionsRes.count ?? 0,
    pendingMergeSuggestions: pendingSuggestionsRes.count ?? 0,
    approvedMergeSuggestions: approvedSuggestionsRes.count ?? 0,
  });

  const errors = [
    unknownRes.error,
    missingLinksRes.error,
    emptyFamiliesRes.error,
    openImportSessionsRes.error,
    pendingSuggestionsRes.error,
    approvedSuggestionsRes.error,
    duplicateGroupsRes.error,
  ].filter(Boolean);

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h1 className="title">Admin Health</h1>
        <p className="mt-1 text-sm text-stone-500">
          Tổng quan nhanh trạng thái dữ liệu, import sessions và maintenance.
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <AdminHealthShortcuts />

        <section
          className={`rounded-2xl border p-5 shadow-sm ${
            health.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <div className="flex gap-3">
            {health.ok ? (
              <ShieldCheck className="mt-0.5 size-7 shrink-0 text-emerald-600" />
            ) : (
              <ShieldX className="mt-0.5 size-7 shrink-0 text-red-600" />
            )}

            <div>
              <h2 className="text-lg font-bold">
                {health.ok ? "System health OK" : "System health needs attention"}
              </h2>
              <p className="mt-1 text-sm opacity-80">
                Trang này chỉ đọc dữ liệu. Bấm từng card để mở công cụ xử lý tương ứng.
              </p>
            </div>
          </div>
        </section>

        {errors.length > 0 ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Một số chỉ số chưa tải được. Kiểm tra các migration RPC audit/maintenance đã chạy trong Supabase.
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {health.metrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </section>

        
      </main>
    </div>
  );
}

function toRpcCount(data: unknown): number {
  const value = (data as any)?.count;

  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}
