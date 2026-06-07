"use server";

import { recordAuditLog } from "@/services/audit/auditLog.service";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/utils/supabase/queries";
import { createClient } from "@supabase/supabase-js";
import { assertAdminAction } from "@/utils/permissions/assertPersonAccess";


function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_DEFAULT_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Thiếu SUPABASE_SERVICE_ROLE_KEY để repair person_events lỗi.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function chunk<T>(items: T[], size = 500) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function repairEventsMissingPersonLinks() {
  const permission = await assertAdminAction("data_maintenance.repair_events_missing_links", "data_maintenance");
  if (!permission.ok) return { ok: false as const, error: permission.error ?? "Chỉ quản trị viên mới được thực hiện thao tác này." };

  const supabase = await getSupabase();

  const { data, error } = await supabase.rpc(
    "repair_events_missing_person_links",
  );

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    };
  }

  await recordAuditLog({
    action: "data_maintenance.repair_events_missing_links",
    entityType: "data_maintenance",
    entityId: "events_missing_links",
    severity: "warning",
    metadata: { result: data },
  });

  revalidatePath("/dashboard/data-maintenance/events-missing-links");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/data-quality");

  return {
    ok: true as const,
    result: data,
  };
}
export async function softDeleteEmptyFamilies() {
  const permission = await assertAdminAction("data_maintenance.soft_delete_empty_families", "data_maintenance");
  if (!permission.ok) return { ok: false as const, error: permission.error ?? "Chỉ quản trị viên mới được thực hiện thao tác này." };

  const supabase = await getSupabase();

  const { data, error } = await supabase.rpc("soft_delete_empty_families");

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    };
  }

  await recordAuditLog({
    action: "data_maintenance.soft_delete_empty_families",
    entityType: "data_maintenance",
    entityId: "empty_families",
    severity: "warning",
    metadata: { result: data },
  });

  revalidatePath("/dashboard/data-maintenance");
  revalidatePath("/dashboard/data-maintenance/empty-families");
  revalidatePath("/dashboard/data-quality");
  revalidatePath("/dashboard/stats");

  return {
    ok: true as const,
    result: data,
  };
}
export async function softDeleteDuplicateBirthDeathEvents() {
  const permission = await assertAdminAction("data_maintenance.soft_delete_duplicate_events", "data_maintenance");
  if (!permission.ok) return { ok: false as const, error: permission.error ?? "Chỉ quản trị viên mới được thực hiện thao tác này." };

  const supabase = await getSupabase();

  const { data, error } = await supabase.rpc(
    "soft_delete_duplicate_birth_death_events",
  );

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    };
  }

  await recordAuditLog({
    action: "data_maintenance.soft_delete_duplicate_events",
    entityType: "data_maintenance",
    entityId: "duplicate_birth_death_events",
    severity: "warning",
    metadata: { result: data },
  });

  revalidatePath("/dashboard/data-maintenance");
  revalidatePath("/dashboard/data-maintenance/duplicate-events");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/data-quality");
  revalidatePath("/dashboard/stats");

  return {
    ok: true as const,
    result: data,
  };
}


export async function repairBrokenPersonEvents() {
  const permission = await assertAdminAction(
    "data_maintenance.repair_broken_person_events",
    "data_maintenance",
  );

  if (!permission.ok) {
    return {
      ok: false as const,
      error: permission.error ?? "Chỉ quản trị viên mới được thực hiện thao tác này.",
    };
  }

  try {
    const supabase = getSupabaseAdmin();

    const [personEventsRes, personsRes, eventsRes] = await Promise.all([
      supabase.from("person_events").select("id, person_id, event_id").limit(100000),
      supabase.from("persons").select("id").is("deleted_at", null).limit(100000),
      supabase.from("events").select("id").is("deleted_at", null).limit(100000),
    ]);

    if (personEventsRes.error) {
      return { ok: false as const, error: personEventsRes.error.message };
    }
    if (personsRes.error) {
      return { ok: false as const, error: personsRes.error.message };
    }
    if (eventsRes.error) {
      return { ok: false as const, error: eventsRes.error.message };
    }

    const activePersonIds = new Set((personsRes.data ?? []).map((row) => row.id));
    const activeEventIds = new Set((eventsRes.data ?? []).map((row) => row.id));

    const brokenPersonEvents = (personEventsRes.data ?? []).filter((row) => {
      return !activePersonIds.has(row.person_id) || !activeEventIds.has(row.event_id);
    });

    const brokenPersonEventIds = brokenPersonEvents.map((row) => row.id);

    for (const ids of chunk(brokenPersonEventIds)) {
      const { error } = await supabase.from("person_events").delete().in("id", ids);
      if (error) return { ok: false as const, error: error.message };
    }

    const remainingPersonEventsRes = await supabase
      .from("person_events")
      .select("event_id")
      .limit(100000);

    if (remainingPersonEventsRes.error) {
      return { ok: false as const, error: remainingPersonEventsRes.error.message };
    }

    const linkedEventIds = new Set(
      (remainingPersonEventsRes.data ?? []).map((row) => row.event_id).filter(Boolean),
    );

    const orphanEventIds = (eventsRes.data ?? [])
      .map((row) => row.id)
      .filter((eventId) => !linkedEventIds.has(eventId));

    const now = new Date().toISOString();
    for (const ids of chunk(orphanEventIds)) {
      const { error } = await supabase
        .from("events")
        .update({ deleted_at: now })
        .in("id", ids)
        .is("deleted_at", null);

      if (error) return { ok: false as const, error: error.message };
    }

    const result = {
      deletedPersonEvents: brokenPersonEventIds.length,
      softDeletedOrphanEvents: orphanEventIds.length,
    };

    await recordAuditLog({
      action: "data_maintenance.repair_broken_person_events",
      entityType: "data_maintenance",
      entityId: "broken_person_events",
      severity: "warning",
      metadata: { result },
    });

    revalidatePath("/dashboard/data-maintenance");
    revalidatePath("/dashboard/data-maintenance/broken-person-events");
    revalidatePath("/dashboard/data-quality");
    revalidatePath("/dashboard/events");

    return {
      ok: true as const,
      result,
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Không repair được person_events lỗi.",
    };
  }
}
