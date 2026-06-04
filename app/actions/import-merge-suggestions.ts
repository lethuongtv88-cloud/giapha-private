"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/utils/supabase/queries";
import { buildGedcomMergeSuggestionDrafts } from "@/services/import/gedcomMergeSuggestions.service";

export async function generateGedcomMergeSuggestions(input: {
  sessionId: string;
}) {
  const supabase = await getSupabase();

  const [sessionRes, recordsRes, eventsRes] = await Promise.all([
    supabase
      .from("import_sessions")
      .select("id, status")
      .eq("id", input.sessionId)
      .maybeSingle(),

    supabase
      .from("import_staging_records")
      .select(
        "id, record_type, external_id, parent_external_id, action, status, normalized_payload",
      )
      .eq("session_id", input.sessionId)
      .in("record_type", ["person", "event"])
      .order("sort_order", { ascending: true }),

    supabase
      .from("events")
      .select(
        "id, type, legacy_person_id, start_date, end_date, sort_date, deleted_at",
      ),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    return {
      ok: false as const,
      error: sessionRes.error?.message ?? "Không tìm thấy import session.",
    };
  }

  if (sessionRes.data.status === "committed") {
    return {
      ok: false as const,
      error: "Session đã committed, không thể tạo merge suggestions.",
    };
  }

  if (recordsRes.error) {
    return {
      ok: false as const,
      error: recordsRes.error.message,
    };
  }

  if (eventsRes.error) {
    return {
      ok: false as const,
      error: eventsRes.error.message,
    };
  }

  const drafts = buildGedcomMergeSuggestionDrafts({
    sessionId: input.sessionId,
    records: (recordsRes.data ?? []) as any,
    existingEvents: (eventsRes.data ?? []) as any,
  });

  if (drafts.length === 0) {
    revalidatePath(`/dashboard/import/${input.sessionId}`);
    revalidatePath(`/dashboard/import/${input.sessionId}/merge`);

    return {
      ok: true as const,
      inserted: 0,
      message: "Không có merge suggestion mới cần tạo.",
    };
  }

  const { error } = await supabase
    .from("import_merge_suggestions")
    .upsert(drafts, {
      onConflict:
        "session_id,suggestion_type,matched_person_id,source_external_id",
      ignoreDuplicates: true,
    });

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    };
  }

  revalidatePath(`/dashboard/import/${input.sessionId}`);
  revalidatePath(`/dashboard/import/${input.sessionId}/merge`);

  return {
    ok: true as const,
    inserted: drafts.length,
    message: `Đã tạo ${drafts.length} merge suggestions.`,
  };
}

export async function updateGedcomMergeSuggestionStatus(input: {
  suggestionId: string;
  sessionId: string;
  status: "pending" | "approved" | "skipped" | "rejected";
}) {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from("import_merge_suggestions")
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.suggestionId)
    .eq("session_id", input.sessionId)
    .neq("status", "committed");

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    };
  }

  revalidatePath(`/dashboard/import/${input.sessionId}/merge`);

  return {
    ok: true as const,
  };
}

export async function bulkApproveGedcomMergeSuggestions(input: {
  sessionId: string;
}) {
  const supabase = await getSupabase();

  const { error } = await supabase
    .from("import_merge_suggestions")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", input.sessionId)
    .eq("status", "pending");

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    };
  }

  revalidatePath(`/dashboard/import/${input.sessionId}/merge`);

  return {
    ok: true as const,
  };
}
export async function commitApprovedGedcomMergeSuggestions(input: {
  sessionId: string;
}) {
  const supabase = await getSupabase();

  const { data, error } = await supabase.rpc(
    "commit_gedcom_merge_suggestions",
    {
      p_session_id: input.sessionId,
    },
  );

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    };
  }

  revalidatePath(`/dashboard/import/${input.sessionId}`);
  revalidatePath(`/dashboard/import/${input.sessionId}/merge`);
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/data-quality");

  return {
    ok: true as const,
    result: data,
  };
}
