"use server";

import { buildGedcomCommitPlan } from "@/services/import/gedcomCommitPlan.service";
import { getSupabase } from "@/utils/supabase/queries";

export async function getGedcomCommitPlan(input: {
  sessionId: string;
}) {
  const supabase = await getSupabase();

  const { data: session, error: sessionError } = await supabase
    .from("import_sessions")
    .select("id, status")
    .eq("id", input.sessionId)
    .single();

  if (sessionError || !session) {
    return {
      ok: false as const,
      error: sessionError?.message ?? "Không tìm thấy import session.",
    };
  }

  const { data: records, error: recordsError } = await supabase
    .from("import_staging_records")
    .select(
      "id, record_type, external_id, parent_external_id, action, confidence, status, normalized_payload, warnings, errors, sort_order",
    )
    .eq("session_id", input.sessionId)
    .order("sort_order", { ascending: true });

  if (recordsError) {
    return {
      ok: false as const,
      error: recordsError.message,
    };
  }

  const plan = buildGedcomCommitPlan({
    sessionId: input.sessionId,
    records: records ?? [],
  });

  return {
    ok: true as const,
    plan,
  };
}
