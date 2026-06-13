import { createClient } from "@supabase/supabase-js";
import { featureFlags } from "@/lib/featureFlags";

export type GraphNode = {
  id: string;
  full_name?: string | null;
  gender?: "male" | "female" | "other" | string | null;
};

export type GraphEdge =
  | {
      type: "spouse";
      spouseA: string;
      spouseB: string;
      familyId?: string;
      legacyRelationshipId?: string | null;
    }
  | {
      type: "parent-child";
      parentId: string;
      childId: string;
      familyId?: string;
      relationshipType?: string | null;
      migrationConfidence?: string | null;
      legacyRelationshipId?: string | null;
    };

export type UnifiedGraph = {
  source: "legacy" | "families";
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing Supabase public key");

  return createClient(url, key);
}

export async function buildGraphFromLegacyRelationships(): Promise<UnifiedGraph> {
  const supabase = getBrowserSupabase();

  const { data: persons, error: personsError } = await supabase
    .from("persons_active")
    .select("id, full_name, gender");

  if (personsError) throw personsError;

  const { data: relationships, error: relError } = await supabase
    .from("relationships_active")
    .select("id, type, person_a, person_b");

  if (relError) throw relError;

  const edges: GraphEdge[] = [];

  for (const r of relationships ?? []) {
    if (!r.person_a || !r.person_b) continue;

    if (r.type === "marriage") {
      edges.push({
        type: "spouse",
        spouseA: r.person_a,
        spouseB: r.person_b,
        legacyRelationshipId: r.id,
      });
    }

    if (r.type === "biological_child" || r.type === "adopted_child") {
      edges.push({
        type: "parent-child",
        parentId: r.person_a,
        childId: r.person_b,
        relationshipType: r.type,
        legacyRelationshipId: r.id,
      });
    }
  }

  return {
    source: "legacy",
    nodes: persons ?? [],
    edges,
  };
}

export async function buildGraphFromFamilies(): Promise<UnifiedGraph> {
  const supabase = getBrowserSupabase();

  const { data: persons, error: personsError } = await supabase
    .from("persons_active")
    .select("id, full_name, gender");

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
    .select(
      "family_id, person_id, relationship_type, migration_confidence, legacy_relationship_id, sort_order",
    )
    .in("migration_confidence", ["certain", "review", "manual"]);

  if (childrenError) throw childrenError;

  const parentsByFamily = new Map<string, typeof parents>();
  for (const p of parents ?? []) {
    const arr = parentsByFamily.get(p.family_id) ?? [];
    arr.push(p);
    parentsByFamily.set(p.family_id, arr);
  }

  const childrenByFamily = new Map<string, typeof children>();
  for (const c of children ?? []) {
    const arr = childrenByFamily.get(c.family_id) ?? [];
    arr.push(c);
    childrenByFamily.set(c.family_id, arr);
  }

  const edges: GraphEdge[] = [];

  for (const fam of families ?? []) {
    const famParents = [...(parentsByFamily.get(fam.id) ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );

    const famChildren = [...(childrenByFamily.get(fam.id) ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );

    if (famParents.length >= 2) {
      edges.push({
        type: "spouse",
        spouseA: famParents[0].person_id,
        spouseB: famParents[1].person_id,
        familyId: fam.id,
        legacyRelationshipId: fam.legacy_relationship_id,
      });
    }

    for (const child of famChildren) {
      for (const parent of famParents) {
        edges.push({
          type: "parent-child",
          parentId: parent.person_id,
          childId: child.person_id,
          familyId: fam.id,
          relationshipType: child.relationship_type,
          migrationConfidence: child.migration_confidence,
          legacyRelationshipId: child.legacy_relationship_id,
        });
      }
    }
  }

  return {
    source: "families",
    nodes: persons ?? [],
    edges,
  };
}

export async function buildUnifiedGraph(): Promise<UnifiedGraph> {
  if (featureFlags.readFamilies) {
    const graph = await buildGraphFromFamilies();

    if (graph.nodes.length > 0) {
      return graph;
    }
  }

  return buildGraphFromLegacyRelationships();
}
