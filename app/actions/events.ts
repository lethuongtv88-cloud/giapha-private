"use server";

import { recordAuditLog } from "@/services/audit/auditLog.service";
import { assertCanEditPerson } from "@/utils/permissions/assertPersonAccess";
import { getProfile, getSupabase } from "@/utils/supabase/queries";
import { revalidatePath } from "next/cache";

const ALLOWED_EVENT_TYPES = new Set([
  "birth",
  "death",
  "death_anniversary",
  "marriage",
  "divorce",
  "burial",
  "baptism",
  "confirmation",
  "ordination",
  "graduation",
  "occupation",
  "residence",
  "migration",
  "military",
  "award",
  "retirement",
  "custom",
  "wedding",
]);

const ALLOWED_DATE_PRECISIONS = new Set([
  "day",
  "month",
  "year",
  "decade",
  "range",
  "text",
  "unknown",
]);

type EventDatePayload = {
  start_date: string | null;
  end_date: string | null;
  sort_date: string | null;
  date_precision: string;
  date_original_text: string | null;
};

function cleanText(value: FormDataEntryValue | null) {
  const text = value?.toString().trim() ?? "";
  return text.length > 0 ? text : null;
}

function normalizeEventType(value: FormDataEntryValue | null) {
  const type = value?.toString() || "custom";
  return ALLOWED_EVENT_TYPES.has(type) ? type : "custom";
}

function normalizeDatePrecision(value: FormDataEntryValue | null) {
  const precision = value?.toString() || "unknown";
  return ALLOWED_DATE_PRECISIONS.has(precision) ? precision : "unknown";
}

function isValidDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
  );
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toIsoDay(raw: string) {
  const value = raw.trim();

  const ddmmyyyy = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const year = Number(ddmmyyyy[3]);
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return isValidDate(iso) ? iso : null;
  }

  const yyyymmdd = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) {
    const year = Number(yyyymmdd[1]);
    const month = Number(yyyymmdd[2]);
    const day = Number(yyyymmdd[3]);
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return isValidDate(iso) ? iso : null;
  }

  return null;
}

function toIsoMonth(raw: string) {
  const value = raw.trim();

  const mmyyyy = value.match(/^(\d{1,2})[-/](\d{4})$/);
  if (mmyyyy) {
    const month = Number(mmyyyy[1]);
    const year = Number(mmyyyy[2]);
    if (month < 1 || month > 12) return null;
    return { year, month };
  }

  const yyyymm = value.match(/^(\d{4})-(\d{1,2})$/);
  if (yyyymm) {
    const year = Number(yyyymm[1]);
    const month = Number(yyyymm[2]);
    if (month < 1 || month > 12) return null;
    return { year, month };
  }

  return null;
}

function normalizePersonEventDate(input: {
  dateText: string | null;
  precision: string;
}): EventDatePayload {
  const raw = input.dateText?.trim() ?? "";
  const precision = ALLOWED_DATE_PRECISIONS.has(input.precision)
    ? input.precision
    : "unknown";

  if (!raw || precision === "unknown") {
    return {
      start_date: null,
      end_date: null,
      sort_date: null,
      date_precision: "unknown",
      date_original_text: raw || null,
    };
  }

  if (precision === "day") {
    const iso = toIsoDay(raw);
    if (!iso) {
      throw new Error("Ngày chính xác phải có dạng dd-mm-yyyy, ví dụ 21-07-2015.");
    }

    return {
      start_date: iso,
      end_date: iso,
      sort_date: iso,
      date_precision: "day",
      date_original_text: raw,
    };
  }

  if (precision === "month") {
    const parsed = toIsoMonth(raw);
    if (!parsed) {
      throw new Error("Ngày tháng/năm phải có dạng mm-yyyy, ví dụ 07-2015.");
    }

    const year = parsed.year;
    const month = parsed.month;
    const start = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
    const end = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
      lastDayOfMonth(year, month),
    ).padStart(2, "0")}`;

    return {
      start_date: start,
      end_date: end,
      sort_date: start,
      date_precision: "month",
      date_original_text: raw,
    };
  }

  if (precision === "year") {
    const match = raw.match(/^(\d{1,4})$/);
    if (!match) {
      throw new Error("Năm phải có dạng yyyy, ví dụ 2015.");
    }

    const year = String(Number(match[1])).padStart(4, "0");

    return {
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
      sort_date: `${year}-01-01`,
      date_precision: "year",
      date_original_text: raw,
    };
  }

  return {
    start_date: null,
    end_date: null,
    sort_date: null,
    date_precision: precision,
    date_original_text: raw,
  };
}

async function assertCanManagePersonEvent(
  personId: string,
  action: string,
  eventId?: string | null,
) {
  const profile = await getProfile();

  if (profile?.role !== "admin" && profile?.role !== "editor") {
    await recordAuditLog({
      action: "permission.denied",
      entityType: "event",
      entityId: eventId ?? personId,
      severity: "warning",
      metadata: {
        requestedAction: action,
        personId,
        reason: "editor_or_admin_required",
      },
    });

    return {
      ok: false as const,
      error: "Chỉ Admin hoặc Editor mới có quyền thêm/sửa/xóa sự kiện.",
    };
  }

  const permission = await assertCanEditPerson(personId, {
    action,
    entityType: "event",
    entityId: eventId ?? null,
    metadata: { personId },
  });

  if (!permission.ok) {
    return {
      ok: false as const,
      error: permission.error ?? "Bạn không có quyền sửa sự kiện của người này.",
    };
  }

  return { ok: true as const, profile };
}

function normalizeNullableNumber(value: string | null, label: string) {
  if (!value) return null;

  const number = Number(value);

  if (!Number.isInteger(number)) {
    throw new Error(`${label} phải là số nguyên.`);
  }

  return number;
}

function buildEventPayload(formData: FormData) {
  const type = normalizeEventType(formData.get("type"));
  const title = cleanText(formData.get("title"));
  const description = cleanText(formData.get("description"));
  const placeText = cleanText(formData.get("place_text"));
  const placeId = cleanText(formData.get("place_id"));
  const precision = normalizeDatePrecision(formData.get("date_precision"));
  const dateText = cleanText(formData.get("date_text"));

  const lunarYearRaw = cleanText(formData.get("lunar_year"));
  const lunarMonthRaw = cleanText(formData.get("lunar_month"));
  const lunarDayRaw = cleanText(formData.get("lunar_day"));

  const datePayload = normalizePersonEventDate({ dateText, precision });

  const lunarYear = normalizeNullableNumber(lunarYearRaw, "Năm âm lịch");
  const lunarMonth = normalizeNullableNumber(lunarMonthRaw, "Tháng âm lịch");
  const lunarDay = normalizeNullableNumber(lunarDayRaw, "Ngày âm lịch");

  if (lunarMonth != null && (lunarMonth < 1 || lunarMonth > 12)) {
    throw new Error("Tháng âm lịch phải nằm trong khoảng 1-12.");
  }

  if (lunarDay != null && (lunarDay < 1 || lunarDay > 30)) {
    throw new Error("Ngày âm lịch phải nằm trong khoảng 1-30.");
  }

  return {
    type,
    title,
    description,
    place_text: placeText,
    place_id: placeId,
    start_date: datePayload.start_date,
    end_date: datePayload.end_date,
    sort_date: datePayload.sort_date,
    date_precision: datePayload.date_precision,
    date_modifier: datePayload.start_date ? "exact" : "unknown",
    canonical_calendar:
      lunarYearRaw || lunarMonthRaw || lunarDayRaw ? "lunar" : "gregorian",
    date_original_text: datePayload.date_original_text,
    lunar_year: lunarYear,
    lunar_month: lunarMonth,
    lunar_day: lunarDay,
    lunar_is_leap_month: formData.get("lunar_is_leap_month") === "true",
    legacy_source: "manual.person_event",
    migration_confidence: "manual",
  };
}

async function assertCanManageFamilyEvent(
  personAId: string,
  personBId: string,
  action: string,
  eventId?: string | null,
) {
  const first = await assertCanManagePersonEvent(personAId, action, eventId);
  if (!first.ok) return first;

  const second = await assertCanManagePersonEvent(personBId, action, eventId);
  if (!second.ok) return second;

  return { ok: true as const };
}



function normalizeRelatedPersonIds(values: FormDataEntryValue[]) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => value.toString().split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function buildWeddingDescription(input: {
  announcementText: string | null;
  timeText: string | null;
  invitationText: string | null;
  description: string | null;
}) {
  const parts: string[] = [];

  if (input.announcementText) parts.push(input.announcementText);
  if (input.timeText) parts.push(`Thời gian: ${input.timeText}`);
  if (input.invitationText) parts.push(`Nội dung thiệp cưới:\n${input.invitationText}`);
  if (input.description) parts.push(input.description);

  return parts.join("\n\n") || null;
}

type PersonBrief = {
  id: string;
  full_name: string;
  gender?: string | null;
};

type SupabaseClientLike = Awaited<ReturnType<typeof getSupabase>>;

function formatParentLine(person: PersonBrief | null, parents: PersonBrief[]) {
  if (!person) return null;

  const father = parents.find((parent) => parent.gender === "male");
  const mother = parents.find((parent) => parent.gender === "female");
  const otherParents = parents.filter(
    (parent) => parent.id !== father?.id && parent.id !== mother?.id,
  );

  if (father && mother) {
    return `${person.full_name}, con ông ${father.full_name} và bà ${mother.full_name}`;
  }

  if (father) return `${person.full_name}, con ông ${father.full_name}`;
  if (mother) return `${person.full_name}, con bà ${mother.full_name}`;

  if (otherParents.length > 0) {
    return `${person.full_name}, con của ${otherParents
      .map((parent) => parent.full_name)
      .join(" và ")}`;
  }

  return person.full_name;
}

async function getPersonBriefs(
  supabase: SupabaseClientLike,
  personIds: string[],
) {
  const ids = Array.from(new Set(personIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, PersonBrief>();

  const { data, error } = await supabase
    .from("persons")
    .select("id, full_name, gender")
    .in("id", ids);

  if (error) throw new Error(error.message);

  return new Map(
    ((data ?? []) as PersonBrief[]).map((person) => [person.id, person]),
  );
}

async function getParentsForPerson(
  supabase: SupabaseClientLike,
  personId: string,
) {
  const { data: childRows, error: childError } = await supabase
    .from("family_children")
    .select("family_id")
    .eq("person_id", personId);

  if (childError) throw new Error(childError.message);

  const familyIds = Array.from(
    new Set((childRows ?? []).map((row) => row.family_id).filter(Boolean)),
  );

  if (familyIds.length === 0) return [] as PersonBrief[];

  const { data: parentRows, error: parentError } = await supabase
    .from("family_parents")
    .select("person_id")
    .in("family_id", familyIds);

  if (parentError) throw new Error(parentError.message);

  const parentIds = Array.from(
    new Set((parentRows ?? []).map((row) => row.person_id).filter(Boolean)),
  );

  const parentMap = await getPersonBriefs(supabase, parentIds);
  return parentIds
    .map((parentId) => parentMap.get(parentId))
    .filter(Boolean) as PersonBrief[];
}

async function buildWeddingAnnouncement(input: {
  supabase: SupabaseClientLike;
  brideId: string | null;
  groomId: string | null;
}) {
  const personMap = await getPersonBriefs(
    input.supabase,
    [input.brideId, input.groomId].filter(Boolean) as string[],
  );

  const bride = input.brideId ? personMap.get(input.brideId) ?? null : null;
  const groom = input.groomId ? personMap.get(input.groomId) ?? null : null;

  const brideParents = input.brideId
    ? await getParentsForPerson(input.supabase, input.brideId)
    : [];
  const groomParents = input.groomId
    ? await getParentsForPerson(input.supabase, input.groomId)
    : [];

  const lines = [
    bride ? `Cô dâu: ${formatParentLine(bride, brideParents)}.` : null,
    groom ? `Chú rể: ${formatParentLine(groom, groomParents)}.` : null,
  ].filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : null;
}

async function findFamilyIdForCouple(
  supabase: SupabaseClientLike,
  personAId: string,
  personBId: string,
) {
  const { data: parentRows, error } = await supabase
    .from("family_parents")
    .select("family_id, person_id");

  if (error) throw new Error(error.message);

  const byFamily = new Map<string, Set<string>>();

  for (const row of parentRows ?? []) {
    if (!row.family_id || !row.person_id) continue;
    if (!byFamily.has(row.family_id)) byFamily.set(row.family_id, new Set());
    byFamily.get(row.family_id)?.add(row.person_id);
  }

  for (const [familyId, parentIds] of byFamily.entries()) {
    if (parentIds.has(personAId) && parentIds.has(personBId)) {
      return familyId;
    }
  }

  return null;
}

async function assertCanCreateAdminEvent(rootPersonId: string | null) {
  const profile = await getProfile();

  if (profile?.role !== "admin" && profile?.role !== "editor") {
    await recordAuditLog({
      action: "permission.denied",
      entityType: "event",
      severity: "warning",
      metadata: {
        requestedAction: "event.admin.create",
        rootPersonId,
        reason: "editor_or_admin_required",
      },
    });

    return {
      ok: false as const,
      error: "Chỉ Admin hoặc Editor mới có quyền tạo sự kiện chung.",
    };
  }

  if (profile.role !== "admin" && rootPersonId) {
    const permission = await assertCanEditPerson(rootPersonId, {
      action: "event.admin.create",
      entityType: "event",
      entityId: null,
      metadata: { rootPersonId },
    });

    if (!permission.ok) {
      return {
        ok: false as const,
        error:
          permission.error ??
          "Bạn không có quyền tạo sự kiện cho nhánh được chọn.",
      };
    }
  }

  return { ok: true as const, profile };
}

export async function createAdminEvent(formData: FormData) {
  const type = normalizeEventType(formData.get("type"));
  const rootPersonId = cleanText(formData.get("root_person_id"));
  const brideId = cleanText(formData.get("bride_id"));
  const groomId = cleanText(formData.get("groom_id"));

  const permission = await assertCanCreateAdminEvent(rootPersonId);
  if (!permission.ok) return { error: permission.error };

  if (type === "wedding" && !brideId && !groomId) {
    return { error: "Sự kiện đám cưới cần chọn cô dâu hoặc chú rể." };
  }

  try {
    const supabase = await getSupabase();
    const basePayload = buildEventPayload(formData);
    const timeText = cleanText(formData.get("time_text"));
    const invitationText = cleanText(formData.get("invitation_text"));
    const manualDescription = cleanText(formData.get("description"));
    const weddingAnnouncement =
      type === "wedding"
        ? await buildWeddingAnnouncement({ supabase, brideId, groomId })
        : null;

    const title =
      basePayload.title ||
      (type === "wedding" ? "Đám cưới / Thiệp cưới" : "Sự kiện gia đình");

    const eventPayload = {
      ...basePayload,
      type,
      title,
      description:
        type === "wedding"
          ? buildWeddingDescription({
              announcementText: weddingAnnouncement,
              timeText,
              invitationText,
              description: manualDescription,
            })
          : buildWeddingDescription({
              announcementText: null,
              timeText,
              invitationText: null,
              description: manualDescription,
            }),
      legacy_source:
        type === "wedding" ? "manual.admin_wedding" : "manual.admin_event",
      migration_confidence: "manual",
    };

    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .insert(eventPayload)
      .select("id")
      .single();

    if (eventError || !eventRow) {
      return {
        error: eventError?.message ?? "Không tạo được sự kiện chung.",
      };
    }

    const links = new Map<string, string>();

    if (rootPersonId) links.set(rootPersonId, "visibility_root");
    if (brideId) links.set(brideId, "wife");
    if (groomId) links.set(groomId, "husband");

    if (links.size > 0) {
      const { error: linkError } = await supabase.from("person_events").insert(
        Array.from(links.entries()).map(([personId, role]) => ({
          person_id: personId,
          event_id: eventRow.id,
          role,
        })),
      );

      if (linkError) {
        await supabase
          .from("events")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", eventRow.id);

        return { error: linkError.message };
      }
    }

    const auditResult = await recordAuditLog({
      action: "event.created",
      entityType: "event",
      entityId: eventRow.id,
      entityLabel: title,
      metadata: {
        type,
        rootPersonId,
        brideId,
        groomId,
        timeText,
        placeText: eventPayload.place_text,
        source: "admin_event_form",
      },
    });

    revalidatePath("/dashboard/events");
    if (rootPersonId) revalidatePath(`/dashboard/members/${rootPersonId}`);
    if (brideId) revalidatePath(`/dashboard/members/${brideId}`);
    if (groomId) revalidatePath(`/dashboard/members/${groomId}`);

    return {
      success: true,
      eventId: eventRow.id,
      auditOk: auditResult.ok,
      auditError: auditResult.ok ? null : auditResult.error,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Không tạo được sự kiện chung.",
    };
  }
}

export async function createFamilyEvent(formData: FormData) {
  const personAId = cleanText(formData.get("person_a_id"));
  const personBId = cleanText(formData.get("person_b_id"));
  const familyId = cleanText(formData.get("family_id"));
  const eventType = normalizeEventType(formData.get("type"));

  if (!personAId || !personBId) {
    return { error: "Thiếu thông tin hai người liên quan đến sự kiện." };
  }

  if (eventType !== "marriage" && eventType !== "divorce") {
    return { error: "Sự kiện gia đình chỉ hỗ trợ kết hôn hoặc ly hôn." };
  }

  const permission = await assertCanManageFamilyEvent(
    personAId,
    personBId,
    `event.${eventType}.create`,
  );

  if (!permission.ok) return { error: permission.error };

  try {
    const supabase = await getSupabase();
    const eventPayload = {
      ...buildEventPayload(formData),
      type: eventType,
      family_id: familyId,
      legacy_source:
        eventType === "marriage"
          ? "manual.marriage_event"
          : "manual.divorce_event",
    };

    // Tránh tạo nhiều event cùng loại cho cùng family khi người dùng bấm lưu lặp.
    // Nếu có family_id, update event cùng family/type mới nhất thay vì tạo trùng.
    let existingEventId: string | null = null;

    if (familyId) {
      const { data: existing, error: existingError } = await supabase
        .from("events")
        .select("id")
        .eq("family_id", familyId)
        .eq("type", eventType)
        .is("deleted_at", null)
        .order("sort_date", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (existingError) return { error: existingError.message };
      existingEventId = existing?.id ?? null;
    }

    let eventId = existingEventId;

    if (eventId) {
      const { error: updateError } = await supabase
        .from("events")
        .update(eventPayload)
        .eq("id", eventId)
        .is("deleted_at", null);

      if (updateError) return { error: updateError.message };
    } else {
      const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .insert(eventPayload)
        .select("id")
        .single();

      if (eventError || !eventRow) {
        return { error: eventError?.message ?? "Không tạo được sự kiện gia đình." };
      }

      eventId = eventRow.id;
    }

    for (const personId of [personAId, personBId]) {
      const { data: existingLink, error: linkCheckError } = await supabase
        .from("person_events")
        .select("id")
        .eq("person_id", personId)
        .eq("event_id", eventId)
        .limit(1)
        .maybeSingle();

      if (linkCheckError) return { error: linkCheckError.message };

      if (!existingLink) {
        const { error: linkError } = await supabase.from("person_events").insert({
          person_id: personId,
          event_id: eventId,
          role: "principal",
        });

        if (linkError) return { error: linkError.message };
      }
    }

    await recordAuditLog({
      action: eventType === "marriage" ? "event.marriage_saved" : "event.divorce_saved",
      entityType: "event",
      entityId: eventId,
      entityLabel: eventPayload.title ?? eventPayload.type,
      metadata: {
        familyId,
        personAId,
        personBId,
        type: eventType,
      },
    });

    revalidatePath(`/dashboard/members/${personAId}`);
    revalidatePath(`/dashboard/members/${personBId}`);
    revalidatePath("/dashboard/events");

    return { success: true, eventId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Không lưu được sự kiện gia đình.",
    };
  }
}

export async function createPersonEvent(formData: FormData) {
  const personId = cleanText(formData.get("person_id"));
  if (!personId) return { error: "Thiếu person_id." };

  try {
    const supabase = await getSupabase();
    const eventPayload = buildEventPayload(formData);
    const spousePersonId = cleanText(formData.get("spouse_person_id"));

    if (eventPayload.type === "marriage") {
      if (!spousePersonId) {
        return { error: "Sự kiện kết hôn cần chọn người kết hôn với." };
      }

      const permission = await assertCanManageFamilyEvent(
        personId,
        spousePersonId,
        "event.marriage.create",
      );

      if (!permission.ok) return { error: permission.error };

      const familyId = await findFamilyIdForCouple(
        supabase,
        personId,
        spousePersonId,
      );

      const marriagePayload = {
        ...eventPayload,
        type: "marriage",
        family_id: familyId,
        legacy_source: "manual.marriage_event",
      };

      const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .insert(marriagePayload)
        .select("id")
        .single();

      if (eventError || !eventRow) {
        return { error: eventError?.message ?? "Không tạo được sự kiện kết hôn." };
      }

      const links = Array.from(new Set([personId, spousePersonId])).map(
        (linkedPersonId) => ({
          person_id: linkedPersonId,
          event_id: eventRow.id,
          role: "principal",
        }),
      );

      const { error: linkError } = await supabase
        .from("person_events")
        .insert(links);

      if (linkError) {
        await supabase
          .from("events")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", eventRow.id);

        return { error: linkError.message };
      }

      await recordAuditLog({
        action: "event.created",
        entityType: "event",
        entityId: eventRow.id,
        entityLabel: marriagePayload.title ?? "Kết hôn",
        metadata: {
          personId,
          spousePersonId,
          familyId,
          type: "marriage",
          source: "person_event_form",
        },
      });

      revalidatePath(`/dashboard/members/${personId}`);
      revalidatePath(`/dashboard/members/${spousePersonId}`);
      revalidatePath("/dashboard/events");

      return { success: true, eventId: eventRow.id };
    }

    const permission = await assertCanManagePersonEvent(personId, "event.create");
    if (!permission.ok) return { error: permission.error };

    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .insert(eventPayload)
      .select("id")
      .single();

    if (eventError || !eventRow) {
      return { error: eventError?.message ?? "Không tạo được sự kiện." };
    }

    const { error: linkError } = await supabase.from("person_events").insert({
      person_id: personId,
      event_id: eventRow.id,
      role:
        eventPayload.type === "death" || eventPayload.type === "death_anniversary"
          ? "deceased"
          : "principal",
    });

    if (linkError) {
      await supabase
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", eventRow.id);

      return { error: linkError.message };
    }

    await recordAuditLog({
      action: "event.created",
      entityType: "event",
      entityId: eventRow.id,
      entityLabel: eventPayload.title ?? eventPayload.type,
      metadata: { personId, type: eventPayload.type },
    });

    revalidatePath(`/dashboard/members/${personId}`);
    revalidatePath("/dashboard/events");

    return { success: true, eventId: eventRow.id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Không tạo được sự kiện.",
    };
  }
}

export async function updatePersonEvent(formData: FormData) {
  const personId = cleanText(formData.get("person_id"));
  const eventId = cleanText(formData.get("event_id"));

  if (!personId || !eventId) {
    return { error: "Thiếu person_id hoặc event_id." };
  }

  const permission = await assertCanManagePersonEvent(
    personId,
    "event.update",
    eventId,
  );

  if (!permission.ok) return { error: permission.error };

  try {
    const supabase = await getSupabase();

    const { data: link, error: linkError } = await supabase
      .from("person_events")
      .select("id")
      .eq("person_id", personId)
      .eq("event_id", eventId)
      .limit(1)
      .maybeSingle();

    if (linkError) return { error: linkError.message };
    if (!link) return { error: "Sự kiện này không thuộc thành viên đang chọn." };

    const eventPayload = buildEventPayload(formData);

    const { error: updateError } = await supabase
      .from("events")
      .update(eventPayload)
      .eq("id", eventId)
      .is("deleted_at", null);

    if (updateError) return { error: updateError.message };

    await recordAuditLog({
      action: "event.updated",
      entityType: "event",
      entityId: eventId,
      entityLabel: eventPayload.title ?? eventPayload.type,
      metadata: { personId, type: eventPayload.type },
    });

    revalidatePath(`/dashboard/members/${personId}`);
    revalidatePath("/dashboard/events");

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Không cập nhật được sự kiện.",
    };
  }
}

export async function softDeletePersonEvent(input: {
  personId: string;
  eventId: string;
}) {
  const permission = await assertCanManagePersonEvent(
    input.personId,
    "event.delete",
    input.eventId,
  );

  if (!permission.ok) return { error: permission.error };

  try {
    const supabase = await getSupabase();

    const { data: link, error: linkError } = await supabase
      .from("person_events")
      .select("id")
      .eq("person_id", input.personId)
      .eq("event_id", input.eventId)
      .limit(1)
      .maybeSingle();

    if (linkError) return { error: linkError.message };
    if (!link) return { error: "Sự kiện này không thuộc thành viên đang chọn." };

    const { error } = await supabase
      .from("events")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.eventId)
      .is("deleted_at", null);

    if (error) return { error: error.message };

    await recordAuditLog({
      action: "event.deleted",
      entityType: "event",
      entityId: input.eventId,
      severity: "warning",
      metadata: { personId: input.personId },
    });

    revalidatePath(`/dashboard/members/${input.personId}`);
    revalidatePath("/dashboard/events");

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Không xóa được sự kiện.",
    };
  }
}