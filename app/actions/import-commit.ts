"use server";

import { revalidatePath } from "next/cache";
import { commitApprovedGedcomStaging } from "@/services/import/gedcomCommit.service";
import { getSupabase } from "@/utils/supabase/queries";

export async function commitGedcomStagingSession(input: {
  sessionId: string;
}) {
  const supabase = await getSupabase();

  const result = await commitApprovedGedcomStaging({
    supabase,
    sessionId: input.sessionId,
  });

  revalidatePath(`/dashboard/import/${input.sessionId}`);
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/stats");
  revalidatePath("/dashboard/data-quality");
  revalidatePath("/dashboard/dual-ancestry");

  return result;
}
