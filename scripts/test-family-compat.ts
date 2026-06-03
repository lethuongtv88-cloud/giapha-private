import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { getRelationshipsFromFamilies } from "../compat/family.compat";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

  const { data: legacy, error: legacyError } = await supabase
    .from("relationships_active")
    .select("id, type, person_a, person_b");

  if (legacyError) throw legacyError;

  const compat = await getRelationshipsFromFamilies(supabase);

  const legacyMarriage = (legacy ?? []).filter((r) => r.type === "marriage");
  const legacyChild = (legacy ?? []).filter(
    (r) => r.type === "biological_child" || r.type === "adopted_child",
  );

  const compatMarriage = compat.filter((r) => r.type === "marriage");
  const compatChild = compat.filter(
    (r) => r.type === "biological_child" || r.type === "adopted_child",
  );

  console.log("=== FAMILY COMPAT TEST ===");
  console.log({
    legacyTotal: legacy?.length ?? 0,
    legacyMarriage: legacyMarriage.length,
    legacyChild: legacyChild.length,
    compatTotal: compat.length,
    compatMarriage: compatMarriage.length,
    compatChild: compatChild.length,
  });

  console.log("Sample compat:");
  console.log(compat.slice(0, 10));
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
