"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/utils/supabase/queries";

export async function cancelImportSession(input: {
  sessionId: string;
}) {
  const supabase = await getSupabase();

  const { data: session, error: loadError } = await supabase
    .from("import_sessions")
    .select("id, status")
    .eq("id", input.sessionId)
    .single();

  if (loadError || !session) {
    return {
      ok: false as const,
      error: loadError?.message ?? "Không tìm thấy import session.",
    };
  }

  if (session.status === "committed") {
    return {
      ok: false as const,
      error: "Session đã committed, không thể hủy.",
    };
  }

  const { error } = await supabase
    .from("import_sessions")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId)
    .neq("status", "committed");

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    };
  }

  revalidatePath("/dashboard/import");
  revalidatePath(`/dashboard/import/${input.sessionId}`);

  return {
    ok: true as const,
  };
}

export async function deleteUncommittedImportSession(input: {
  sessionId: string;
}) {
  const supabase = await getSupabase();

  const { data: session, error: loadError } = await supabase
    .from("import_sessions")
    .select("id, status")
    .eq("id", input.sessionId)
    .single();

  if (loadError || !session) {
    return {
      ok: false as const,
      error: loadError?.message ?? "Không tìm thấy import session.",
    };
  }

  if (session.status === "committed") {
    return {
      ok: false as const,
      error: "Session đã committed, không thể xóa staging session.",
    };
  }

  const { error } = await supabase
    .from("import_sessions")
    .delete()
    .eq("id", input.sessionId)
    .neq("status", "committed");

  if (error) {
    return {
      ok: false as const,
      error: error.message,
    };
  }

  revalidatePath("/dashboard/import");

  return {
    ok: true as const,
  };
}
