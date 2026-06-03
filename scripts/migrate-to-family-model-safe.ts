import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

type Person = {
  id: string;
  full_name: string | null;
  gender: string | null;
  deleted_at?: string | null;
};

type Relationship = {
  id: string;
  type: string;
  person_a: string;
  person_b: string;
  deleted_at?: string | null;
};

type FamilyCandidate = {
  legacy_marriage_id: string;
  family_id: string | null;
  parent_ids: string[];
  parent_names: string[];
};

const DRY_RUN = process.env.DRY_RUN !== "false";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY. Dùng service role key, không dùng anon key.",
  );
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
  realtime: {
    transport: ws as any,
  },
});

function personName(p?: Person) {
  return p?.full_name || p?.id || "Unknown";
}

function roleForPerson(p?: Person): "husband" | "wife" | "partner" {
  if (p?.gender === "male") return "husband";
  if (p?.gender === "female") return "wife";
  return "partner";
}

function childType(relType: string): "biological" | "adopted" | "unknown" {
  if (relType === "biological_child") return "biological";
  if (relType === "adopted_child") return "adopted";
  return "unknown";
}

async function main() {
  console.log("=== FAMILY MODEL MIGRATION SAFE ===");
  console.log("DRY_RUN =", DRY_RUN);

  const { data: persons, error: personsError } = await supabase
    .from("persons_active")
    .select("id, full_name, gender, deleted_at");

  if (personsError) throw personsError;

  const { data: relationships, error: relsError } = await supabase
    .from("relationships_active")
    .select("id, type, person_a, person_b, deleted_at");

  if (relsError) throw relsError;

  const people = new Map<string, Person>();
  for (const p of (persons || []) as Person[]) people.set(p.id, p);

  const marriages = ((relationships || []) as Relationship[]).filter(
    (r) => r.type === "marriage",
  );

  const childRels = ((relationships || []) as Relationship[]).filter(
    (r) => r.type === "biological_child" || r.type === "adopted_child",
  );

  console.log("persons:", people.size);
  console.log("marriages:", marriages.length);
  console.log("child relationships:", childRels.length);

  const parentMarriageMap = new Map<string, Relationship[]>();

  for (const m of marriages) {
    for (const parentId of [m.person_a, m.person_b]) {
      const list = parentMarriageMap.get(parentId) || [];
      list.push(m);
      parentMarriageMap.set(parentId, list);
    }
  }

  let familiesWouldCreate = 0;
  let familyParentsWouldCreate = 0;
  let familyChildrenCertain = 0;
  let reviewCount = 0;
  let skippedCount = 0;

  const migrationReviews: Array<{
    migration_name: string;
    entity_type: string;
    child_id: string;
    parent_id: string;
    candidate_families: FamilyCandidate[];
    reason: string;
    status: "pending";
  }> = [];

  const familyByMarriage = new Map<string, string>();

  for (const m of marriages) {
    familiesWouldCreate += 1;
    familyParentsWouldCreate += 2;

    if (!DRY_RUN) {
      const parentA = people.get(m.person_a);
      const parentB = people.get(m.person_b);

      const { data: familyResult, error: familyError } = await supabase.rpc(
        "create_family_unit",
        {
          payload: {
            type: "marriage",
            status: "active",
            legacy_relationship_id: m.id,
            parent_a_id: m.person_a,
            parent_a_role: roleForPerson(parentA),
            parent_b_id: m.person_b,
            parent_b_role: roleForPerson(parentB),
          },
        },
      );

      if (familyError) throw familyError;
      if (!familyResult?.success) {
        throw new Error(
          `create_family_unit failed for marriage ${m.id}: ${JSON.stringify(
            familyResult,
          )}`,
        );
      }

      familyByMarriage.set(m.id, familyResult.family_id);
    } else {
      familyByMarriage.set(m.id, null as unknown as string);
    }
  }

  for (const rel of childRels) {
    const parentId = rel.person_a;
    const childId = rel.person_b;
    const parentMarriages = parentMarriageMap.get(parentId) || [];

    if (parentMarriages.length === 0) {
      skippedCount += 1;
      migrationReviews.push({
        migration_name: "family_model_v1",
        entity_type: "child_relationship",
        child_id: childId,
        parent_id: parentId,
        candidate_families: [],
        reason: "Parent has no marriage family. Legacy relationship cannot infer family unit.",
        status: "pending",
      });
      reviewCount += 1;
      continue;
    }

    if (parentMarriages.length > 1) {
      const candidates: FamilyCandidate[] = parentMarriages.map((m) => ({
        legacy_marriage_id: m.id,
        family_id: familyByMarriage.get(m.id) || null,
        parent_ids: [m.person_a, m.person_b],
        parent_names: [personName(people.get(m.person_a)), personName(people.get(m.person_b))],
      }));

      migrationReviews.push({
        migration_name: "family_model_v1",
        entity_type: "child_relationship",
        child_id: childId,
        parent_id: parentId,
        candidate_families: candidates,
        reason: "Parent has multiple marriages. Manual review required to avoid assigning child to wrong family.",
        status: "pending",
      });

      reviewCount += 1;
      continue;
    }

    const onlyMarriage = parentMarriages[0];
    const familyId = familyByMarriage.get(onlyMarriage.id);

    familyChildrenCertain += 1;

    if (!DRY_RUN) {
      if (!familyId) {
        throw new Error(`Missing family_id for marriage ${onlyMarriage.id}`);
      }

      const { error } = await supabase.from("family_children").insert({
        family_id: familyId,
        person_id: childId,
        relationship_type: childType(rel.type),
        legacy_relationship_id: rel.id,
        migration_confidence: "certain",
      });

      if (error && !String(error.message).includes("duplicate")) {
        throw error;
      }
    }
  }

  if (!DRY_RUN && migrationReviews.length > 0) {
    const { error } = await supabase.from("migration_review").insert(migrationReviews);
    if (error) throw error;
  }

  console.log("");
  console.log("=== REPORT ===");
  console.log("families would create:", familiesWouldCreate);
  console.log("family parents would create:", familyParentsWouldCreate);
  console.log("family children certain:", familyChildrenCertain);
  console.log("review cases:", reviewCount);
  console.log("skipped:", skippedCount);

  if (migrationReviews.length > 0) {
    console.log("");
    console.log("=== REVIEW SAMPLE ===");
    for (const r of migrationReviews.slice(0, 20)) {
      console.log({
        child: personName(people.get(r.child_id)),
        parent: personName(people.get(r.parent_id)),
        reason: r.reason,
        candidates: r.candidate_families,
      });
    }
  }

  console.log("");
  if (DRY_RUN) {
    console.log("DRY RUN ONLY: không ghi families/family_children/migration_review.");
  } else {
    console.log("REAL RUN DONE.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
