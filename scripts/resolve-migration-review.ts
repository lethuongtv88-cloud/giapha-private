import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

type Resolution = {
  child_name: string;
  parent_name: string;
  selected_family_label: string;
};

const resolutions: Resolution[] = [
  {
    child_name: "Nguyễn Duy Thái",
    parent_name: "Phạm Thị Dội",
    selected_family_label: "Nguyễn Văn Phú + Phạm Thị Dội",
  },
  {
    child_name: "Nguyễn Trung Nguyên",
    parent_name: "Phạm Thị Dội",
    selected_family_label: "Nguyễn Văn Phú + Phạm Thị Dội",
  },
  {
    child_name: "Lê Khôi Nguyên",
    parent_name: "Phạm Thị Dội",
    selected_family_label: "Lê Văn Phong + Phạm Thị Dội",
  },

  {
    child_name: "Cô 2 Tiệp",
    parent_name: "Bà Nội Vợ",
    selected_family_label: "Ông Nội Vợ + Bà Nội Vợ",
  },
  {
    child_name: "Nguyễn Minh Luân",
    parent_name: "Bà Nội Vợ",
    selected_family_label: "Ông Nội Vợ + Bà Nội Vợ",
  },
  {
    child_name: "Chú 4 Hoàng",
    parent_name: "Bà Nội Vợ",
    selected_family_label: "Ông Nội Vợ + Bà Nội Vợ",
  },
  {
    child_name: "Chú 5 Thới",
    parent_name: "Bà Nội Vợ",
    selected_family_label: "Ông Nội Vợ 2 + Bà Nội Vợ",
  },
  {
    child_name: "Cô 6 Yến",
    parent_name: "Bà Nội Vợ",
    selected_family_label: "Ông Nội Vợ 3 + Bà Nội Vợ",
  },
  {
    child_name: "Chú 7 Truyền",
    parent_name: "Bà Nội Vợ",
    selected_family_label: "Ông Nội Vợ 3 + Bà Nội Vợ",
  },
  {
    child_name: "Chú 8 Nguyễn",
    parent_name: "Bà Nội Vợ",
    selected_family_label: "Ông Nội Vợ 3 + Bà Nội Vợ",
  },
  {
    child_name: "Chú Út Giang",
    parent_name: "Bà Nội Vợ",
    selected_family_label: "Ông Nội Vợ 3 + Bà Nội Vợ",
  },
];

function candidateLabel(candidate: any) {
  if (Array.isArray(candidate.parent_names)) {
    return candidate.parent_names.join(" + ");
  }

  return `${candidate.parent_a_name ?? ""} + ${candidate.parent_b_name ?? ""}`.trim();
}

async function main() {
  const dryRun = process.env.DRY_RUN !== "false";

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

  console.log("=== RESOLVE MIGRATION REVIEW ===");
  console.log("DRY_RUN =", dryRun);

  const { data: reviews, error: reviewError } = await supabase
    .from("migration_review")
    .select("id, child_id, parent_id, candidate_families, status")
    .eq("status", "pending");

  if (reviewError) throw reviewError;

  const { data: persons, error: personsError } = await supabase
    .from("persons")
    .select("id, full_name");

  if (personsError) throw personsError;

  const personNameById = new Map<string, string>();
  const personIdByName = new Map<string, string>();

  for (const p of persons ?? []) {
    personNameById.set(p.id, p.full_name ?? "");
    if (p.full_name) personIdByName.set(p.full_name, p.id);
  }

  let resolved = 0;
  let skipped = 0;

  for (const item of resolutions) {
    const childId = personIdByName.get(item.child_name);
    const parentId = personIdByName.get(item.parent_name);

    if (!childId || !parentId) {
      console.log("❌ Không tìm thấy person:", item);
      skipped++;
      continue;
    }

    const review = (reviews ?? []).find(
      (r) => r.child_id === childId && r.parent_id === parentId,
    );

    if (!review) {
      console.log("⚠️ Không tìm thấy pending review, có thể đã resolved:", item);
      skipped++;
      continue;
    }

    const candidates = Array.isArray(review.candidate_families)
      ? review.candidate_families
      : [];

    const selected = candidates.find(
      (c: any) => candidateLabel(c) === item.selected_family_label,
    );

    if (!selected?.family_id) {
      console.log("❌ Không tìm thấy candidate family:", {
        child: item.child_name,
        parent: item.parent_name,
        selected: item.selected_family_label,
        candidates: candidates.map(candidateLabel),
      });
      skipped++;
      continue;
    }

    console.log("Resolve:", {
      child: item.child_name,
      parent: item.parent_name,
      family: item.selected_family_label,
      family_id: selected.family_id,
      review_id: review.id,
    });

    if (!dryRun) {
      const { error: insertError } = await supabase
        .from("family_children")
        .insert({
          family_id: selected.family_id,
          person_id: childId,
          relationship_type: "biological",
          migration_confidence: "manual",
          legacy_relationship_id: null,
        });

      if (insertError && insertError.code !== "23505") {
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from("migration_review")
        .update({
          status: "resolved",
          suggested_family_id: selected.family_id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", review.id);

      if (updateError) throw updateError;
    }

    resolved++;
  }

  console.log("");
  console.log("=== RESULT ===");
  console.log({
    dryRun,
    resolved,
    skipped,
  });

  if (dryRun) {
    console.log("");
    console.log("DRY RUN ONLY. Chưa ghi DB.");
    console.log("Nếu danh sách Resolve ở trên đúng, chạy:");
    console.log("DRY_RUN=false bunx tsx scripts/resolve-migration-review.ts");
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
