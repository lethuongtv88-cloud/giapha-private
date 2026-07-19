import { getProfile, getSupabase, getUser } from "@/utils/supabase/queries";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.role_changed"
  | "user.status_changed"
  | "user.password_reset"
  | "member.deleted"
  | "relationship.created"
  | "relationship.deleted"
  | "relationship.divorced"
  | "relationship.restored"
  | "data_maintenance.repair_events_missing_links"
  | "data_maintenance.soft_delete_empty_families"
  | "data_maintenance.soft_delete_duplicate_events"
  | "data_maintenance.repair_broken_person_events"
  | "gedcom.parse_staging"
  | "gedcom.commit_staging_session"
  | "family_model.repair"
  | "account.preferences_updated"
  | "event.created"
  | "event.updated"
  | "event.deleted"
  | "event.marriage_saved"
  | "event.divorce_saved"
  | "permission.denied"
  | "home_assistant.token_created"
  | "home_assistant.token_revoked"
  | "home_assistant.api_accessed"
  | "backup.created"
  | "backup.deleted"
  | "backup.cleanup"
  | "backup.failed"
  | "backup.retention_updated";

export type AuditEntityType =
  | "user"
  | "person"
  | "relationship"
  | "family"
  | "event"
  | "gedcom_session"
  | "data_maintenance"
  | "account"
  | "system"
  | "home_assistant_token"
  | "backup";

export type AuditSeverity = "info" | "warning" | "danger";

export type AuditLogInput = {
  action?: AuditAction | string | null;

  // camelCase: dùng trong code mới
  entityType?: AuditEntityType | string | null;
  entityId?: string | null;
  entityLabel?: string | null;

  // snake_case: chấp nhận để tương thích nếu caller truyền trực tiếp theo DB field
  entity_type?: AuditEntityType | string | null;
  entity_id?: string | null;
  entity_label?: string | null;

  severity?: AuditSeverity | null;
  metadata?: Record<string, unknown> | null;

  // Cho các trường hợp chạy bằng service role/RPC mà không có cookie user
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
};

export type AuditLogRecord = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  severity: AuditSeverity;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function normalizeMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return {};

  return JSON.parse(
    JSON.stringify(metadata, (_key, value) => {
      if (typeof value === "bigint") return value.toString();

      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }

      return value;
    }),
  ) as Record<string, unknown>;
}

function normalizeSeverity(severity: AuditSeverity | null | undefined): AuditSeverity {
  if (severity === "warning" || severity === "danger" || severity === "info") {
    return severity;
  }

  return "info";
}


function isUuid(value: string | null | undefined) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getAuditSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_SECRET;

  if (!url || !serviceRoleKey) return null;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Ghi audit log.
 *
 * Nguyên tắc quan trọng:
 * - Audit log là phụ trợ, không được làm hỏng nghiệp vụ chính.
 * - Nếu caller truyền thiếu action/entityType thì tự fallback.
 * - Nếu insert audit thất bại thì chỉ console.error và return { ok: false }, không throw.
 */
export async function recordAuditLog(input: AuditLogInput) {
  const fallbackError = "Không ghi được audit log.";

  try {
    const [user, profile] = await Promise.all([getUser(), getProfile()]);

    const actorUserId = input.actorUserId ?? input.actor_user_id ?? user?.id ?? null;
    const actorEmail = input.actorEmail ?? input.actor_email ?? user?.email ?? null;
    const actorRole = input.actorRole ?? input.actor_role ?? profile?.role ?? null;
    const action = String(input.action || "unknown");
    const entityType = String(input.entityType || input.entity_type || "system");
    const entityId = input.entityId ?? input.entity_id ?? null;
    const entityLabel = input.entityLabel ?? input.entity_label ?? null;
    const metadata = normalizeMetadata(input.metadata);
    const recordId = isUuid(entityId) ? entityId : crypto.randomUUID();

    const payload = {
      // Cột legacy: một số DB đã từng tạo audit_logs theo trigger generic.
      // Luôn truyền đủ để không bị lỗi NOT NULL hoặc schema cache cũ.
      table_name: entityType,
      record_id: recordId,
      changed_by: actorUserId,
      old_data: null,
      new_data: metadata,
      source: "app",
      changed_at: new Date().toISOString(),

      // Cột audit app hiện tại.
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      actor_role: actorRole,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      severity: normalizeSeverity(input.severity),
      metadata,
    };

    const userClient = await getSupabase();

    // Ưu tiên RPC SECURITY DEFINER để audit log không phụ thuộc vào schema cũ
    // hoặc RLS insert trực tiếp. Nếu RPC chưa được migrate thì fallback xuống insert.
    const { error: rpcError } = await userClient.rpc("insert_audit_log", {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_entity_label: entityLabel,
      p_severity: normalizeSeverity(input.severity),
      p_metadata: metadata,
      p_actor_user_id: actorUserId,
      p_actor_email: actorEmail,
      p_actor_role: actorRole,
    });

    if (!rpcError) {
      return { ok: true as const };
    }

    console.error("Audit RPC failed, falling back to direct insert:", {
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
      code: rpcError.code,
    });

    // Nếu thiếu RPC ở môi trường dev hoặc chưa chạy migration, dùng service role nếu có,
    // nếu không thì dùng user client.
    const serviceClient = getAuditSupabaseClient();
    const supabase = serviceClient ?? userClient;

    const { error } = await supabase.from("audit_logs").insert(payload);

    if (error) {
      console.error("Failed to record audit log:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        usedServiceRole: Boolean(serviceClient),
        payload,
      });

      return { ok: false as const, error: error.message || fallbackError };
    }

    return { ok: true as const };
  } catch (error) {
    console.error("Failed to record audit log:", error);

    return {
      ok: false as const,
      error: error instanceof Error ? error.message : fallbackError,
    };
  }
}

export async function getAuditLogs(input?: {
  action?: string | null;
  entityType?: string | null;
  actorUserId?: string | null;
  severity?: AuditSeverity | null;
  limit?: number;
}) {
  const profile = await getProfile();

  if (profile?.role !== "admin") {
    return {
      error: "Bạn không có quyền xem nhật ký hệ thống.",
      logs: [] as AuditLogRecord[],
    };
  }

  const supabase = await getSupabase();

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 200);

  if (input?.action) query = query.eq("action", input.action);
  if (input?.entityType) query = query.eq("entity_type", input.entityType);
  if (input?.actorUserId) query = query.eq("actor_user_id", input.actorUserId);
  if (input?.severity) query = query.eq("severity", input.severity);

  const { data, error } = await query;

  if (error) {
    return { error: error.message, logs: [] as AuditLogRecord[] };
  }

  return { logs: (data ?? []) as AuditLogRecord[], error: null };
}