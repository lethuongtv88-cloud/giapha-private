import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      transport: ws as any,
    },
    global: {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    },
  });

  const { count: personsCount, error: personsError } = await supabase
    .from("persons_active")
    .select("*", { count: "exact", head: true });

  const { count: legacyMarriageCount, error: legacyMarriageError } = await supabase
    .from("relationships_active")
    .select("*", { count: "exact", head: true })
    .eq("type", "marriage");

  const { count: legacyChildCount, error: legacyChildError } = await supabase
    .from("relationships_active")
    .select("*", { count: "exact", head: true })
    .in("type", ["biological_child", "adopted_child"]);

  const { count: familiesCount, error: familiesError } = await supabase
    .from("families")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  const { count: familyParentsCount, error: familyParentsError } = await supabase
    .from("family_parents")
    .select("*", { count: "exact", head: true });

  const { count: familyChildrenAllCount, error: familyChildrenAllError } =
    await supabase
      .from("family_children")
      .select("*", { count: "exact", head: true });

  const { count: familyChildrenCertainCount, error: familyChildrenError } =
    await supabase
      .from("family_children")
      .select("*", { count: "exact", head: true })
      .eq("migration_confidence", "certain");

  const { count: migrationReviewPendingCount, error: migrationReviewError } =
    await supabase
      .from("migration_review")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

  const { count: nullFamilyIdReviewCount, error: nullFamilyIdReviewError } =
    await supabase
      .from("migration_review")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .like("candidate_families", '%"family_id":null%');

  console.log("=== FAMILY MODEL SERVICE TEST ===");
  console.log({
    personsCount,
    legacyMarriageCount,
    legacyChildCount,
    familiesCount,
    familyParentsCount,
    familyChildrenAllCount,
    familyChildrenCertainCount,
    migrationReviewPendingCount,
    nullFamilyIdReviewCount,
  });

  console.log("Errors:", {
    personsError,
    legacyMarriageError,
    legacyChildError,
    familiesError,
    familyParentsError,
    familyChildrenAllError,
    familyChildrenError,
    migrationReviewError,
    nullFamilyIdReviewError,
  });
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});