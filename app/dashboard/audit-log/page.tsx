import { getAuditLogs, type AuditLogRecord } from "@/services/audit/auditLog.service";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Audit Log",
};

type SearchParams = Promise<{
  action?: string;
  entityType?: string;
  actorUserId?: string;
  severity?: string;
}>;

const severityOptions = [
  { value: "", label: "Tất cả" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "danger", label: "Danger" },
];

const actionLabels: Record<string, string> = {
  "user.created": "Tạo user",
  "user.updated": "Sửa user",
  "user.deleted": "Xóa user",
  "user.role_changed": "Đổi vai trò",
  "user.status_changed": "Đổi trạng thái user",
  "user.password_reset": "Reset mật khẩu",
  "member.deleted": "Xóa hồ sơ thành viên",
  "relationship.created": "Tạo quan hệ",
  "relationship.deleted": "Xóa quan hệ",
  "relationship.divorced": "Ly hôn",
  "relationship.restored": "Khôi phục hôn nhân",
  "data_maintenance.repair_events_missing_links": "Repair event links",
  "data_maintenance.soft_delete_empty_families": "Xóa mềm family rỗng",
  "data_maintenance.soft_delete_duplicate_events": "Xóa event trùng",
  "data_maintenance.repair_broken_person_events": "Repair person_events lỗi",
  "gedcom.parse_staging": "Parse GEDCOM staging",
  "gedcom.commit_staging_session": "Commit GEDCOM import",
  "family_model.repair": "Repair Family Model",
  "account.preferences_updated": "Cập nhật cài đặt tài khoản",
  "event.created": "Tạo sự kiện",
  "event.updated": "Sửa sự kiện",
  "event.deleted": "Xóa sự kiện",
  "event.marriage_saved": "Lưu sự kiện kết hôn",
  "event.divorce_saved": "Lưu sự kiện ly hôn",
  "permission.denied": "Từ chối quyền",
};

const entityLabels: Record<string, string> = {
  user: "Người dùng",
  person: "Thành viên",
  relationship: "Quan hệ",
  family: "Family Model",
  event: "Sự kiện",
  gedcom_session: "GEDCOM session",
  data_maintenance: "Data Maintenance",
  account: "Tài khoản",
  system: "Hệ thống",
  unknown: "Không rõ",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function severityClass(severity: AuditLogRecord["severity"]) {
  if (severity === "danger") return "border-red-200 bg-red-50 text-red-800";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-sky-200 bg-sky-50 text-sky-800";
}

function compactJson(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) return null;
  return JSON.stringify(value, null, 2);
}

function metadataSummary(value: Record<string, unknown> | null) {
  if (!value) return null;

  const parts: string[] = [];

  const type = typeof value.type === "string" ? value.type : null;
  const source = typeof value.source === "string" ? value.source : null;
  const requestedAction =
    typeof value.requestedAction === "string" ? value.requestedAction : null;
  const reason = typeof value.reason === "string" ? value.reason : null;

  if (type) parts.push(`Loại: ${type}`);
  if (source) parts.push(`Nguồn: ${source}`);
  if (requestedAction) parts.push(`Yêu cầu: ${requestedAction}`);
  if (reason) parts.push(`Lý do: ${reason}`);

  return parts.length > 0 ? parts.join(" · ") : null;
}

function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-stone-700">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await getProfile();
  if (profile?.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const supabase = await getSupabase();

  const { data: actors } = await supabase
    .from("audit_logs")
    .select("actor_user_id, actor_email")
    .not("actor_user_id", "is", null)
    .order("actor_email", { ascending: true })
    .limit(300);

  const actorOptionsMap = new Map<string, string>();
  for (const actor of actors ?? []) {
    const id = actor.actor_user_id as string | null;
    if (!id) continue;
    actorOptionsMap.set(id, (actor.actor_email as string | null) ?? id);
  }

  const actorOptions = [
    { value: "", label: "Tất cả" },
    ...Array.from(actorOptionsMap.entries()).map(([value, label]) => ({
      value,
      label,
    })),
  ];

  const actionOptions = [
    { value: "", label: "Tất cả" },
    ...Object.entries(actionLabels).map(([value, label]) => ({ value, label })),
  ];

  const entityOptions = [
    { value: "", label: "Tất cả" },
    { value: "user", label: "User" },
    { value: "person", label: "Thành viên" },
    { value: "relationship", label: "Quan hệ" },
    { value: "family", label: "Family Model" },
    { value: "event", label: "Sự kiện" },
    { value: "gedcom_session", label: "GEDCOM session" },
    { value: "data_maintenance", label: "Data maintenance" },
    { value: "account", label: "Tài khoản" },
    { value: "system", label: "System" },
  ];

  const severity =
    params.severity === "info" ||
    params.severity === "warning" ||
    params.severity === "danger"
      ? params.severity
      : null;

  const { logs, error } = await getAuditLogs({
    action: params.action || null,
    entityType: params.entityType || null,
    actorUserId: params.actorUserId || null,
    severity,
    limit: 300,
  });

  return (
    <main className="flex-1 overflow-auto bg-stone-50/50 flex flex-col pt-8 relative w-full">
      <div className="max-w-7xl mx-auto px-4 pb-8 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-stone-100 p-3 text-stone-700">
              <Activity className="size-7" />
            </div>
            <div>
              <h1 className="title">Audit Log</h1>
              <p className="text-stone-500 mt-1 text-sm sm:text-base">
                Nhật ký các thao tác quan trọng: quản lý user, repair dữ liệu,
                import GEDCOM và thay đổi hồ sơ.
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <form className="grid gap-4 md:grid-cols-4">
            <FilterSelect
              name="action"
              label="Thao tác"
              defaultValue={params.action}
              options={actionOptions}
            />
            <FilterSelect
              name="entityType"
              label="Đối tượng"
              defaultValue={params.entityType}
              options={entityOptions}
            />
            <FilterSelect
              name="actorUserId"
              label="Người thao tác"
              defaultValue={params.actorUserId}
              options={actorOptions}
            />
            <FilterSelect
              name="severity"
              label="Mức độ"
              defaultValue={params.severity}
              options={severityOptions}
            />

            <div className="md:col-span-4 flex justify-end gap-2">
              <a
                href="/dashboard/audit-log"
                className="rounded-xl bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200"
              >
                Xóa lọc
              </a>
              <button
                type="submit"
                className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Lọc nhật ký
              </button>
            </div>
          </form>
        </section>

        {error ? (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-stone-100 px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-stone-900">Nhật ký gần đây</h2>
              <p className="text-sm text-stone-500">
                Hiển thị tối đa 300 bản ghi mới nhất theo bộ lọc hiện tại.
              </p>
            </div>
            <div className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">
              {logs.length} dòng
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-stone-500">
              Chưa có nhật ký phù hợp.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {logs.map((log) => {
                const metadata = compactJson(log.metadata);
                const summary = metadataSummary(log.metadata);
                const entityLabel = entityLabels[log.entity_type] ?? log.entity_type;
                return (
                  <article key={log.id} className="p-5 hover:bg-stone-50/70">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-bold ${severityClass(
                              log.severity,
                            )}`}
                          >
                            {log.severity}
                          </span>
                          <span className="font-bold text-stone-900">
                            {actionLabels[log.action] ?? log.action}
                          </span>
                          <span className="text-xs text-stone-400">
                            {log.action}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-stone-600">
                          <span className="font-medium text-stone-700">
                            Người thao tác:
                          </span>{" "}
                          {log.actor_email ?? log.actor_user_id ?? "Không rõ"}
                          {log.actor_role ? ` (${log.actor_role})` : ""}
                        </div>

                        <div className="mt-1 text-sm text-stone-600">
                          <span className="font-medium text-stone-700">
                            Đối tượng:
                          </span>{" "}
                          {entityLabel}
                          {log.entity_label ? ` — ${log.entity_label}` : ""}
                          {log.entity_id ? ` (${log.entity_id})` : ""}
                        </div>

                        {summary ? (
                          <p className="mt-2 text-sm text-stone-500">{summary}</p>
                        ) : null}

                        {metadata ? (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-sm font-medium text-amber-700 hover:text-amber-800">
                              Xem metadata
                            </summary>
                            <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-stone-950 p-3 text-xs text-stone-100">
                              {metadata}
                            </pre>
                          </details>
                        ) : null}
                      </div>

                      <time className="shrink-0 text-sm text-stone-500">
                        {formatDate(log.created_at)}
                      </time>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            <p className="text-sm leading-relaxed text-emerald-800">
              Audit Log chỉ cho admin xem. Bản ghi được tạo theo cơ chế best-effort:
              nếu ghi log lỗi, thao tác chính vẫn không bị rollback.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
