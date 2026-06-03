"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/utils/supabase/queries";

type GedcomCommitRpcResult = {
  ok: boolean;
  sessionId: string;
  committed: {
    persons: number;
    personNames: number;
    families: number;
    familyParents: number;
    familyChildren: number;
    events: number;
    personEvents: number;
    stagingRecords: number;
  };
  errors: string[];
  warnings: string[];
};

function emptyCommitted(): GedcomCommitRpcResult["committed"] {
  return {
    persons: 0,
    personNames: 0,
    families: 0,
    familyParents: 0,
    familyChildren: 0,
    events: 0,
    personEvents: 0,
    stagingRecords: 0,
  };
}

export async function commitGedcomStagingSession(input: {
  sessionId: string;
}): Promise<GedcomCommitRpcResult> {
  const supabase = await getSupabase();

  const { data, error } = await supabase.rpc("commit_gedcom_staging_session", {
    p_session_id: input.sessionId,
  });

  revalidatePath(`/dashboard/import/${input.sessionId}`);
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/stats");
  revalidatePath("/dashboard/data-quality");
  revalidatePath("/dashboard/dual-ancestry");

  if (error) {
    return {
      ok: false,
      sessionId: input.sessionId,
      committed: emptyCommitted(),
      errors: [
        error.message,
        error.details,
        error.hint,
        error.code ? `code=${error.code}` : null,
      ].filter(Boolean) as string[],
      warnings: [],
    };
  }

  const result = data as GedcomCommitRpcResult;

  return {
    ok: Boolean(result?.ok),
    sessionId: result?.sessionId ?? input.sessionId,
    committed: result?.committed ?? emptyCommitted(),
    errors: Array.isArray(result?.errors) ? result.errors : [],
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
  };
}