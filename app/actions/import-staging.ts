"use server";

import { createHash } from "crypto";
import { cookies } from "next/headers";
import { buildGedcomStagingPreview } from "@/services/import/gedcomStaging.service";
import { createClient } from "@/utils/supabase/server";

export async function createGedcomStagingSession(input: {
  fileName: string;
  fileSize: number;
  content: string;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Bạn cần đăng nhập để import GEDCOM." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      ok: false as const,
      error: "Chỉ quản trị viên mới được import GEDCOM.",
    };
  }

  const { data: existingPersons, error: existingPersonsError } = await supabase
    .from("persons")
    .select(
      "id, full_name, gender, birth_year, birth_month, birth_day, death_year, death_month, death_day",
    )
    .is("deleted_at", null);

  if (existingPersonsError) {
    return {
      ok: false as const,
      error:
        "Không tải được persons hiện có để matching: " +
        existingPersonsError.message,
    };
  }

  const preview = buildGedcomStagingPreview(input.content, {
    existingPersons: existingPersons ?? [],
  });
  const fileHash = createHash("sha256").update(input.content).digest("hex");

  const { data: session, error: sessionError } = await supabase
    .from("import_sessions")
    .insert({
      source_type: "gedcom",
      file_name: input.fileName,
      file_size: input.fileSize,
      file_hash: fileHash,
      status: "parsed",
      summary: preview.summary,
      warnings: preview.warnings,
      errors: preview.errors,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (sessionError || !session) {
    return {
      ok: false as const,
      error: sessionError?.message ?? "Không tạo được import session.",
    };
  }

  if (preview.records.length > 0) {
    const rows = preview.records.map((record) => ({
      session_id: session.id,
      record_type: record.record_type,
      external_id: record.external_id ?? null,
      parent_external_id: record.parent_external_id ?? null,
      action: record.action,
      confidence: record.confidence,
      status: record.status,
      payload: record.payload,
      normalized_payload: record.normalized_payload,
      warnings: record.warnings,
      errors: record.errors,
      sort_order: record.sort_order,
    }));

    const { error: recordsError } = await supabase
      .from("import_staging_records")
      .insert(rows);

    if (recordsError) {
      return {
        ok: false as const,
        error: "Tạo session được nhưng lưu staging records lỗi: " + recordsError.message,
        sessionId: session.id as string,
      };
    }
  }

  return {
    ok: true as const,
    sessionId: session.id as string,
    summary: preview.summary,
  };
}
