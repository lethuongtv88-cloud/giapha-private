import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function FamilyGraphTestPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { count: personsCount, error: personsError } = await supabase
    .from("persons_active")
    .select("*", { count: "exact", head: true });

  const { count: legacyMarriageCount, error: legacyMarriageError } =
    await supabase
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

  const errors = [
    { name: "persons", error: personsError },
    { name: "legacy_marriage", error: legacyMarriageError },
    { name: "legacy_child", error: legacyChildError },
    { name: "families", error: familiesError },
    { name: "family_parents", error: familyParentsError },
    { name: "family_children_all", error: familyChildrenAllError },
    { name: "family_children_certain", error: familyChildrenError },
    { name: "migration_review", error: migrationReviewError },
  ].filter((x) => x.error);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Family Graph Test</h1>

      <div className="rounded-lg border p-4">
        <p>persons_active: {personsCount ?? "error"}</p>
        <p>legacy marriages: {legacyMarriageCount ?? "error"}</p>
        <p>legacy child relationships: {legacyChildCount ?? "error"}</p>
        <p>families: {familiesCount ?? "error"}</p>
        <p>family_parents: {familyParentsCount ?? "error"}</p>
        <p>family_children all: {familyChildrenAllCount ?? "error"}</p>
        <p>family_children certain: {familyChildrenCertainCount ?? "error"}</p>
        <p>migration_review pending: {migrationReviewPendingCount ?? "error"}</p>
      </div>

      {errors.length > 0 && (
        <pre className="mt-4 overflow-auto rounded border p-4 text-sm">
          {JSON.stringify(errors, null, 2)}
        </pre>
      )}

      <p className="mt-4 text-sm opacity-70">
        Trang này chỉ kiểm tra đọc schema Family Model mới. Chưa thay cây gia phả chính.
      </p>
    </main>
  );
}