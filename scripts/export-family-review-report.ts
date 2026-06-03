import postgres from "postgres";
import fs from "fs";
import path from "path";

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

type CandidateFamily = {
  legacy_marriage_id: string;
  family_id: null;
  parent_a: string;
  parent_b: string;
  parent_a_name: string;
  parent_b_name: string;
};

type ReviewRow = {
  review_type: string;
  reason: string;
  suggested_action: string;
  child_id: string;
  child_name: string;
  parent_id: string | null;
  parent_name: string | null;
  child_relationship_ids: string[];
  parent_count_for_child: number;
  candidate_families_count: number;
  candidate_families: CandidateFamily[];
};

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL chưa được set.");
  console.error("Ví dụ:");
  console.error("export DATABASE_URL='postgresql://...'");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  ssl: "require",
  max: 1,
});

function nameOf(personMap: Map<string, Person>, id: string | null | undefined) {
  if (!id) return "";
  return personMap.get(id)?.full_name || id;
}

function csvEscape(value: unknown) {
  const s = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
  ].join("-") + "_" + [
    pad(d.getHours()),
    pad(d.getMinutes()),
  ].join("-");
}

async function main() {
  console.log("=== EXPORT FAMILY REVIEW REPORT ===");

  const persons = await sql<Person[]>`
    SELECT id, full_name, gender, deleted_at
    FROM public.persons
    WHERE deleted_at IS NULL
  `;

  const relationships = await sql<Relationship[]>`
    SELECT id, type, person_a, person_b, deleted_at
    FROM public.relationships
    WHERE deleted_at IS NULL
      AND type IN ('marriage', 'biological_child', 'adopted_child')
  `;

  const personMap = new Map<string, Person>();
  for (const p of persons) personMap.set(p.id, p);

  const marriages = relationships.filter(r => r.type === "marriage");
  const childRels = relationships.filter(
    r => r.type === "biological_child" || r.type === "adopted_child"
  );

  const marriagesByParent = new Map<string, Relationship[]>();
  for (const m of marriages) {
    if (!marriagesByParent.has(m.person_a)) marriagesByParent.set(m.person_a, []);
    if (!marriagesByParent.has(m.person_b)) marriagesByParent.set(m.person_b, []);

    marriagesByParent.get(m.person_a)!.push(m);
    marriagesByParent.get(m.person_b)!.push(m);
  }

  const childRelsByChild = new Map<string, Relationship[]>();
  for (const r of childRels) {
    if (!childRelsByChild.has(r.person_b)) childRelsByChild.set(r.person_b, []);
    childRelsByChild.get(r.person_b)!.push(r);
  }

  function toCandidate(m: Relationship): CandidateFamily {
    return {
      legacy_marriage_id: m.id,
      family_id: null,
      parent_a: m.person_a,
      parent_b: m.person_b,
      parent_a_name: nameOf(personMap, m.person_a),
      parent_b_name: nameOf(personMap, m.person_b),
    };
  }

  function sameMarriageForTwoParents(parentA: string, parentB: string) {
    return marriages.find(m =>
      (m.person_a === parentA && m.person_b === parentB) ||
      (m.person_a === parentB && m.person_b === parentA)
    );
  }

  const reviewRows: ReviewRow[] = [];
  let certainCount = 0;
  let skippedCount = 0;

  for (const [childId, rels] of childRelsByChild.entries()) {
    const parentIds = Array.from(new Set(rels.map(r => r.person_a).filter(Boolean)));
    const childName = nameOf(personMap, childId);

    // Case có từ 2 parent trở lên
    if (parentIds.length >= 2) {
      const matchingMarriages: Relationship[] = [];

      for (let i = 0; i < parentIds.length; i++) {
        for (let j = i + 1; j < parentIds.length; j++) {
          const m = sameMarriageForTwoParents(parentIds[i], parentIds[j]);
          if (m) matchingMarriages.push(m);
        }
      }

      if (matchingMarriages.length === 1) {
        certainCount++;
        continue;
      }

      const allCandidateMarriageIds = new Set<string>();
      for (const parentId of parentIds) {
        for (const m of marriagesByParent.get(parentId) ?? []) {
          allCandidateMarriageIds.add(m.id);
        }
      }

      const candidateFamilies = marriages
        .filter(m => allCandidateMarriageIds.has(m.id))
        .map(toCandidate);

      reviewRows.push({
        review_type: matchingMarriages.length === 0
          ? "NO_MATCHING_MARRIAGE_FOR_TWO_PARENTS"
          : "MULTIPLE_MATCHING_MARRIAGES",
        reason: matchingMarriages.length === 0
          ? "Child có từ 2 parent relationships nhưng không tìm thấy marriage đúng giữa các parent."
          : "Child có nhiều marriage candidate, cần kiểm tra thủ công.",
        suggested_action: "CHECK_LEGACY_DATA",
        child_id: childId,
        child_name: childName,
        parent_id: null,
        parent_name: null,
        child_relationship_ids: rels.map(r => r.id),
        parent_count_for_child: parentIds.length,
        candidate_families_count: candidateFamilies.length,
        candidate_families: candidateFamilies,
      });

      continue;
    }

    // Case chỉ có 1 parent
    const parentId = parentIds[0];

    if (!parentId) {
      skippedCount++;
      reviewRows.push({
        review_type: "NO_PARENT_ID",
        reason: "Child relationship thiếu parent_id.",
        suggested_action: "CHECK_LEGACY_DATA",
        child_id: childId,
        child_name: childName,
        parent_id: null,
        parent_name: null,
        child_relationship_ids: rels.map(r => r.id),
        parent_count_for_child: 0,
        candidate_families_count: 0,
        candidate_families: [],
      });
      continue;
    }

    const parentMarriages = marriagesByParent.get(parentId) ?? [];
    const candidateFamilies = parentMarriages.map(toCandidate);

    if (parentMarriages.length === 0) {
      skippedCount++;
      reviewRows.push({
        review_type: "SKIPPED_PARENT_HAS_NO_MARRIAGE",
        reason: "Child chỉ có 1 parent relationship, nhưng parent không có marriage family nào.",
        suggested_action: "ADD_MISSING_SPOUSE_OR_ACCEPT_SINGLE_PARENT_UNKNOWN",
        child_id: childId,
        child_name: childName,
        parent_id: parentId,
        parent_name: nameOf(personMap, parentId),
        child_relationship_ids: rels.map(r => r.id),
        parent_count_for_child: 1,
        candidate_families_count: 0,
        candidate_families: [],
      });
      continue;
    }

    if (parentMarriages.length === 1) {
      reviewRows.push({
        review_type: "SINGLE_PARENT_ONE_CANDIDATE_MARRIAGE",
        reason: "Child chỉ có 1 parent relationship. Parent có đúng 1 marriage candidate, nhưng legacy data thiếu parent còn lại nên chưa auto-gán chắc chắn.",
        suggested_action: "REVIEW_OR_ASSIGN_TO_ONLY_CANDIDATE",
        child_id: childId,
        child_name: childName,
        parent_id: parentId,
        parent_name: nameOf(personMap, parentId),
        child_relationship_ids: rels.map(r => r.id),
        parent_count_for_child: 1,
        candidate_families_count: candidateFamilies.length,
        candidate_families: candidateFamilies,
      });
      continue;
    }

    reviewRows.push({
      review_type: "SINGLE_PARENT_MULTIPLE_MARRIAGES",
      reason: "Child chỉ có 1 parent relationship, nhưng parent có nhiều marriage candidate. Không thể biết child thuộc hôn nhân nào.",
      suggested_action: "REVIEW_MULTIPLE_MARRIAGES",
      child_id: childId,
      child_name: childName,
      parent_id: parentId,
      parent_name: nameOf(personMap, parentId),
      child_relationship_ids: rels.map(r => r.id),
      parent_count_for_child: 1,
      candidate_families_count: candidateFamilies.length,
      candidate_families: candidateFamilies,
    });
  }

  const stamp = nowStamp();
  const outDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(outDir, { recursive: true });

  const summary = {
    persons: persons.length,
    marriages: marriages.length,
    child_relationships: childRels.length,
    children_with_child_relationships: childRelsByChild.size,
    certain_children_by_two_parents_matching_marriage: certainCount,
    review_cases: reviewRows.length,
    skipped_parent_has_no_marriage_or_no_parent: skippedCount,
    generated_at: new Date().toISOString(),
  };

  const jsonPath = path.join(outDir, `family-review-${stamp}.json`);
  const csvPath = path.join(outDir, `family-review-${stamp}.csv`);

  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ summary, rows: reviewRows }, null, 2),
    "utf8"
  );

  const headers = [
    "review_type",
    "suggested_action",
    "reason",
    "child_name",
    "child_id",
    "parent_name",
    "parent_id",
    "parent_count_for_child",
    "candidate_families_count",
    "candidate_families",
    "child_relationship_ids",
  ];

  const csvLines = [
    headers.join(","),
    ...reviewRows.map(row => headers.map(h => csvEscape((row as any)[h])).join(",")),
  ];

  fs.writeFileSync(csvPath, csvLines.join("\n"), "utf8");

  console.log("");
  console.log("=== SUMMARY ===");
  console.log(summary);
  console.log("");
  console.log(`✅ JSON: ${jsonPath}`);
  console.log(`✅ CSV : ${csvPath}`);
  console.log("");
  console.log("Gợi ý:");
  console.log("- Mở CSV bằng Excel/LibreOffice để xem từng case.");
  console.log("- Ưu tiên lọc review_type = SKIPPED_PARENT_HAS_NO_MARRIAGE trước.");
  console.log("- Chưa chạy DRY_RUN=false.");
}

main()
  .catch((err) => {
    console.error("❌ Export report failed:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end();
  });
