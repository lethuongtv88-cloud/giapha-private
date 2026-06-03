import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import ws from "ws";

type Person = {
  id: string;
  full_name: string | null;
};

type ReviewRow = {
  id: string;
  reason: string;
  candidate_families: any;
  child_id: string | null;
  parent_id: string | null;
  status: string;
  created_at: string;
};

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

  const { data: reviews, error: reviewError } = await supabase
    .from("migration_review")
    .select(
      "id, reason, candidate_families, child_id, parent_id, status, created_at",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (reviewError) throw reviewError;

  const { data: persons, error: personsError } = await supabase
    .from("persons")
    .select("id, full_name");

  if (personsError) throw personsError;

  const personMap = new Map<string, string>();
  for (const p of (persons ?? []) as Person[]) {
    personMap.set(p.id, p.full_name ?? "");
  }

  fs.mkdirSync("reports", { recursive: true });

  const rows = ((reviews ?? []) as ReviewRow[]).map((r) => {
    const candidates = Array.isArray(r.candidate_families)
      ? r.candidate_families
      : [];

    return {
      review_id: r.id,
      child_name: r.child_id ? personMap.get(r.child_id) ?? "" : "",
      child_id: r.child_id ?? "",
      parent_name: r.parent_id ? personMap.get(r.parent_id) ?? "" : "",
      parent_id: r.parent_id ?? "",
      reason: r.reason,
      candidate_count: candidates.length,
      candidates: candidates
        .map((c: any, idx: number) => {
          const names =
            c.parent_names?.join(" + ") ||
            `${c.parent_a_name ?? ""} + ${c.parent_b_name ?? ""}`;

          return `${idx + 1}. ${names} | family_id=${c.family_id} | legacy_marriage_id=${c.legacy_marriage_id}`;
        })
        .join(" || "),
    };
  });

  const csvHeaders = [
    "review_id",
    "child_name",
    "child_id",
    "parent_name",
    "parent_id",
    "reason",
    "candidate_count",
    "candidates",
  ];

  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const csv = [
    csvHeaders.join(","),
    ...rows.map((row) =>
      csvHeaders.map((h) => esc(row[h as keyof typeof row])).join(","),
    ),
  ].join("\n");

  fs.writeFileSync("reports/migration-review-pending.csv", csv, "utf8");
  fs.writeFileSync(
    "reports/migration-review-pending.json",
    JSON.stringify(rows, null, 2),
    "utf8",
  );

  console.log("Exported:");
  console.log("reports/migration-review-pending.csv");
  console.log("reports/migration-review-pending.json");
  console.log("Rows:", rows.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});