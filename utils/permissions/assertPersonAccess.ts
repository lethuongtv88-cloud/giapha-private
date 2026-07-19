import { recordAuditLog } from "@/services/audit/auditLog.service";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { buildVisiblePersonSetForProfile } from "@/utils/permissions/applyPersonVisibility";

export type PersonAccessCheck = {
  ok: boolean;
  error?: string;
  isAdmin: boolean;
  viewerPersonId: string | null;
  visiblePersonIds: Set<string>;
  editablePersonIds: Set<string>;
};

export type PermissionTarget = {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

async function loadPermissionContext() {
  const supabase = await getSupabase();
  const profile = await getProfile();

  const [personsRes, relationshipsRes, familiesRes, familyParentsRes, familyChildrenRes] =
    await Promise.all([
      supabase.from("persons").select("id, deleted_at"),
      supabase.from("relationships").select("id, type, person_a, person_b, status, deleted_at"),
      supabase.from("families").select("id, status, deleted_at"),
      supabase.from("family_parents").select("family_id, person_id, role"),
      supabase.from("family_children").select("family_id, person_id, relationship_type"),
    ]);

  const firstError =
    personsRes.error ||
    relationshipsRes.error ||
    familiesRes.error ||
    familyParentsRes.error ||
    familyChildrenRes.error;

  if (firstError) {
    return {
      error: firstError.message,
      profile,
      permission: null,
    };
  }

  const permission = buildVisiblePersonSetForProfile({
    profile,
    persons: personsRes.data ?? [],
    relationships: relationshipsRes.data ?? [],
    families: familiesRes.data ?? [],
    familyParents: familyParentsRes.data ?? [],
    familyChildren: familyChildrenRes.data ?? [],
  });

  return { profile, permission, error: null };
}

async function logPermissionDenied(target: PermissionTarget & { reason: string; viewerPersonId?: string | null }) {
  await recordAuditLog({
    action: "permission.denied",
    entityType: target.entityType || "system",
    entityId: target.entityId ?? null,
    severity: "warning",
    metadata: {
      requestedAction: target.action,
      reason: target.reason,
      viewerPersonId: target.viewerPersonId ?? null,
      ...(target.metadata ?? {}),
    },
  });
}

export async function getCurrentPersonAccess(): Promise<PersonAccessCheck> {
  const { profile, permission, error } = await loadPermissionContext();

  if (error || !permission) {
    return {
      ok: false,
      error: error ?? "Không tải được dữ liệu phân quyền.",
      isAdmin: false,
      viewerPersonId: profile?.person_id ?? null,
      visiblePersonIds: new Set(),
      editablePersonIds: new Set(),
    };
  }

  if (permission.isAdmin) {
    return {
      ok: true,
      isAdmin: true,
      viewerPersonId: permission.viewerPersonId,
      visiblePersonIds: permission.visiblePersonIds,
      editablePersonIds: permission.editablePersonIds,
    };
  }

  if (!permission.viewerPersonId) {
    return {
      ok: false,
      error: "Tài khoản chưa được gắn với người trong gia phả.",
      isAdmin: false,
      viewerPersonId: null,
      visiblePersonIds: permission.visiblePersonIds,
      editablePersonIds: permission.editablePersonIds,
    };
  }

  if (permission.visiblePersonIds.size === 0) {
    return {
      ok: false,
      error: permission.warnings[0] ?? "Tài khoản không có phạm vi dữ liệu được phép xem.",
      isAdmin: false,
      viewerPersonId: permission.viewerPersonId,
      visiblePersonIds: permission.visiblePersonIds,
      editablePersonIds: permission.editablePersonIds,
    };
  }

  return {
    ok: true,
    isAdmin: false,
    viewerPersonId: permission.viewerPersonId,
    visiblePersonIds: permission.visiblePersonIds,
    editablePersonIds: permission.editablePersonIds,
  };
}

export async function assertCanEditPerson(
  personId: string,
  target: PermissionTarget = { action: "person.edit", entityType: "person" },
) {
  const access = await getCurrentPersonAccess();

  if (!access.ok) {
    await logPermissionDenied({
      ...target,
      entityId: target.entityId ?? personId,
      reason: access.error ?? "permission_context_invalid",
      viewerPersonId: access.viewerPersonId,
    });
    return { ok: false as const, error: access.error ?? "Bạn không có quyền thực hiện thao tác này." };
  }

  if (access.isAdmin || access.editablePersonIds.has(personId)) {
    return { ok: true as const, access };
  }

  await logPermissionDenied({
    ...target,
    entityId: target.entityId ?? personId,
    reason: "person_outside_editable_scope",
    viewerPersonId: access.viewerPersonId,
    metadata: {
      ...(target.metadata ?? {}),
      personId,
    },
  });

  return {
    ok: false as const,
    error: "Bạn không có quyền sửa người ngoài phạm vi được phép chỉnh sửa.",
  };
}

export async function assertCanEditRelationship(
  personAId: string,
  personBId: string,
  target: PermissionTarget = { action: "relationship.edit", entityType: "relationship" },
) {
  const access = await getCurrentPersonAccess();

  if (!access.ok) {
    await logPermissionDenied({
      ...target,
      reason: access.error ?? "permission_context_invalid",
      viewerPersonId: access.viewerPersonId,
      metadata: {
        ...(target.metadata ?? {}),
        personAId,
        personBId,
      },
    });
    return { ok: false as const, error: access.error ?? "Bạn không có quyền thực hiện thao tác này." };
  }

  if (
    access.isAdmin ||
    (access.editablePersonIds.has(personAId) && access.editablePersonIds.has(personBId))
  ) {
    return { ok: true as const, access };
  }

  await logPermissionDenied({
    ...target,
    reason: "relationship_outside_editable_scope",
    viewerPersonId: access.viewerPersonId,
    metadata: {
      ...(target.metadata ?? {}),
      personAId,
      personBId,
    },
  });

  return {
    ok: false as const,
    error: "Bạn không có quyền sửa quan hệ có người ngoài phạm vi được phép chỉnh sửa.",
  };
}

export async function assertAdminAction(action: string, entityType = "system") {
  const access = await getCurrentPersonAccess();

  if (access.isAdmin) return { ok: true as const, access };

  await logPermissionDenied({
    action,
    entityType,
    reason: "admin_required",
    viewerPersonId: access.viewerPersonId,
  });

  return {
    ok: false as const,
    error: "Chỉ quản trị viên mới được thực hiện thao tác này.",
  };
}
