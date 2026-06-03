import type { SupabaseClient } from "@supabase/supabase-js";

export type LegacyLikeRelationship = {
  id: string;
  type: string;
  person_a: string;
  person_b: string;
  note?: string | null;
  status?: string | null;
  ended_at?: string | null;
  divorce_note?: string | null;
  family_id?: string;
  migration_confidence?: string | null;
};

type FamilyRow = {
  id: string;
  legacy_relationship_id: string | null;
  status?: string | null;
  end_year?: number | null;
  note?: string | null;
};

type FamilyParentRow = {
  family_id: string;
  person_id: string;
  role: string;
  sort_order: number | null;
};

type FamilyChildRow = {
  id: string;
  family_id: string;
  person_id: string;
  relationship_type: string;
  migration_confidence: string | null;
  legacy_relationship_id: string | null;
  sort_order: number | null;
};

export async function getRelationshipsFromFamilies(
  supabase: SupabaseClient,
): Promise<LegacyLikeRelationship[]> {
  const { data: families, error: familiesError } = await supabase
    .from("families")
    .select("id, legacy_relationship_id, status, end_year, note")
    .is("deleted_at", null);

  if (familiesError) throw familiesError;

  const { data: parents, error: parentsError } = await supabase
    .from("family_parents")
    .select("family_id, person_id, role, sort_order");

  if (parentsError) throw parentsError;

  const { data: children, error: childrenError } = await supabase
    .from("family_children")
    .select(
      "id, family_id, person_id, relationship_type, migration_confidence, legacy_relationship_id, sort_order",
    )
    .eq("migration_confidence", "certain");

  if (childrenError) throw childrenError;

  const familyRows = (families ?? []) as FamilyRow[];
  const parentRows = (parents ?? []) as FamilyParentRow[];
  const childRows = (children ?? []) as FamilyChildRow[];

  const parentsByFamily = new Map<string, FamilyParentRow[]>();
  for (const p of parentRows) {
    const arr = parentsByFamily.get(p.family_id) ?? [];
    arr.push(p);
    parentsByFamily.set(p.family_id, arr);
  }

  const childrenByFamily = new Map<string, FamilyChildRow[]>();
  for (const c of childRows) {
    const arr = childrenByFamily.get(c.family_id) ?? [];
    arr.push(c);
    childrenByFamily.set(c.family_id, arr);
  }

  const out: LegacyLikeRelationship[] = [];

  for (const fam of familyRows) {
    const famParents = [...(parentsByFamily.get(fam.id) ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );

    const famChildren = [...(childrenByFamily.get(fam.id) ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );

    // spouse/marriage edge
    if (famParents.length >= 2) {
      out.push({
        id: fam.legacy_relationship_id ?? `family-${fam.id}-marriage`,
        type: "marriage",
        person_a: famParents[0].person_id,
        person_b: famParents[1].person_id,
        note: fam.status === "divorced" ? "Đã ly hôn" : fam.note,
        status: fam.status,
        family_id: fam.id,
      });
    }

    // parent-child edges
    for (const child of famChildren) {
      for (const parent of famParents) {
        out.push({
          id: child.legacy_relationship_id
            ? `${child.legacy_relationship_id}-${parent.person_id}`
            : `family-${fam.id}-child-${child.person_id}-parent-${parent.person_id}`,
          type:
            child.relationship_type === "adopted"
              ? "adopted_child"
              : "biological_child",
          person_a: parent.person_id,
          person_b: child.person_id,
          family_id: fam.id,
          migration_confidence: child.migration_confidence,
        });
      }
    }
  }

  return out;
}
