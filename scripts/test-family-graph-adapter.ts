import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseKey) throw new Error("Missing Supabase public key");

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  realtime: {
    transport: ws as any,
  },
});

type Edge = {
  type: "spouse" | "parent-child";
  parentId?: string;
  childId?: string;
  spouseA?: string;
  spouseB?: string;
};

async function buildLegacyStats() {
  const { data: persons, error: personsError } = await supabase
    .from("persons_active")
    .select("id");

  if (personsError) throw personsError;

  const { data: relationships, error: relError } = await supabase
    .from("relationships_active")
    .select("id, type, person_a, person_b");

  if (relError) throw relError;

  const edges: Edge[] = [];

  for (const r of relationships ?? []) {
    if (!r.person_a || !r.person_b) continue;

    if (r.type === "marriage") {
      edges.push({
        type: "spouse",
        spouseA: r.person_a,
        spouseB: r.person_b,
      });
    }

    if (r.type === "biological_child" || r.type === "adopted_child") {
      edges.push({
        type: "parent-child",
        parentId: r.person_a,
        childId: r.person_b,
      });
    }
  }

  return {
    source: "legacy",
    nodes: persons?.length ?? 0,
    spouseEdges: edges.filter(e => e.type === "spouse").length,
    parentChildEdges: edges.filter(e => e.type === "parent-child").length,
    edges,
  };
}

async function buildFamilyStats() {
  const { data: persons, error: personsError } = await supabase
    .from("persons_active")
    .select("id");

  if (personsError) throw personsError;

  const { data: families, error: familiesError } = await supabase
    .from("families")
    .select("id, legacy_relationship_id")
    .is("deleted_at", null);

  if (familiesError) throw familiesError;

  const { data: parents, error: parentsError } = await supabase
    .from("family_parents")
    .select("family_id, person_id, role, sort_order");

  if (parentsError) throw parentsError;

  const { data: children, error: childrenError } = await supabase
    .from("family_children")
    .select("family_id, person_id, migration_confidence")
    .eq("migration_confidence", "certain");

  if (childrenError) throw childrenError;

  const parentsByFamily = new Map<string, any[]>();
  for (const p of parents ?? []) {
    const arr = parentsByFamily.get(p.family_id) ?? [];
    arr.push(p);
    parentsByFamily.set(p.family_id, arr);
  }

  const childrenByFamily = new Map<string, any[]>();
  for (const c of children ?? []) {
    const arr = childrenByFamily.get(c.family_id) ?? [];
    arr.push(c);
    childrenByFamily.set(c.family_id, arr);
  }

  const edges: Edge[] = [];

  for (const fam of families ?? []) {
    const famParents = parentsByFamily.get(fam.id) ?? [];
    const famChildren = childrenByFamily.get(fam.id) ?? [];

    if (famParents.length >= 2) {
      edges.push({
        type: "spouse",
        spouseA: famParents[0].person_id,
        spouseB: famParents[1].person_id,
      });
    }

    for (const child of famChildren) {
      for (const parent of famParents) {
        edges.push({
          type: "parent-child",
          parentId: parent.person_id,
          childId: child.person_id,
        });
      }
    }
  }

  return {
    source: "families",
    nodes: persons?.length ?? 0,
    families: families?.length ?? 0,
    familyParents: parents?.length ?? 0,
    familyChildrenCertainRows: children?.length ?? 0,
    spouseEdges: edges.filter(e => e.type === "spouse").length,
    parentChildEdges: edges.filter(e => e.type === "parent-child").length,
    edges,
  };
}

function edgeKey(e: Edge) {
  if (e.type === "spouse") {
    const pair = [e.spouseA, e.spouseB].sort().join("::");
    return `spouse:${pair}`;
  }

  return `parent-child:${e.parentId}->${e.childId}`;
}

async function main() {
  const legacy = await buildLegacyStats();
  const families = await buildFamilyStats();

  const legacyKeys = new Set(legacy.edges.map(edgeKey));
  const familyKeys = new Set(families.edges.map(edgeKey));

  const missingInFamilies = [...legacyKeys].filter(k => !familyKeys.has(k));
  const extraInFamilies = [...familyKeys].filter(k => !legacyKeys.has(k));

  console.log("=== GRAPH ADAPTER TEST ===");
  console.log("Legacy:", {
    nodes: legacy.nodes,
    spouseEdges: legacy.spouseEdges,
    parentChildEdges: legacy.parentChildEdges,
  });

  console.log("Families:", {
    nodes: families.nodes,
    families: families.families,
    familyParents: families.familyParents,
    familyChildrenCertainRows: families.familyChildrenCertainRows,
    spouseEdges: families.spouseEdges,
    parentChildEdges: families.parentChildEdges,
  });

  console.log("Compare:", {
    missingInFamilies: missingInFamilies.length,
    extraInFamilies: extraInFamilies.length,
  });

  console.log("");
  console.log("Sample missingInFamilies:");
  console.log(missingInFamilies.slice(0, 20));

  console.log("");
  console.log("Sample extraInFamilies:");
  console.log(extraInFamilies.slice(0, 20));
}

main().catch(err => {
  console.error("FAILED:", err);
  process.exit(1);
});
