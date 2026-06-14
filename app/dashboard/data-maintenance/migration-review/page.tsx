import Link from "next/link";
import { confirmFamilyChildReview } from "@/app/actions/migration-review";
import { getIsAdmin, getSupabase } from "@/utils/supabase/queries";

type FamilyChildRow = {
  id: string;
  family_id: string;
  person_id: string;
  relationship_type: string | null;
  migration_confidence: string | null;
};

type PersonRow = {
  id: string;
  full_name: string | null;
};

type FamilyParentRow = {
  family_id: string;
  person_id: string;
  role: string | null;
};

type ReviewRow = {
  id: string;
  family_id: string;
  person_id: string;
  relationship_type: string | null;
  migration_confidence: string | null;
  child_name: string | null;
  parents: string | null;
};

export default async function MigrationReviewPage() {
  const isAdmin = await getIsAdmin();

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-semibold text-stone-900">
          Rà soát Family Model
        </h1>
        <p className="mt-3 text-stone-600">
          Bạn không có quyền truy cập trang này.
        </p>
      </main>
    );
  }

  const supabase = await getSupabase();

  const { data: familyChildren, error: familyChildrenError } = await supabase
    .from("family_children")
    .select("id, family_id, person_id, relationship_type, migration_confidence")
    .eq("migration_confidence", "review")
    .order("family_id", { ascending: true });

  if (familyChildrenError) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold text-stone-900">
          Rà soát Family Model
        </h1>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Lỗi tải family_children: {familyChildrenError.message}
        </div>
      </main>
    );
  }

  const reviewChildren = (familyChildren ?? []) as FamilyChildRow[];

  const familyIds = Array.from(
    new Set(reviewChildren.map((row) => row.family_id).filter(Boolean)),
  );

  const personIds = new Set<string>();
  for (const row of reviewChildren) {
    personIds.add(row.person_id);
  }

  let familyParents: FamilyParentRow[] = [];

  if (familyIds.length > 0) {
    const { data: parentRows, error: parentRowsError } = await supabase
      .from("family_parents")
      .select("family_id, person_id, role")
      .in("family_id", familyIds);

    if (parentRowsError) {
      return (
        <main className="mx-auto max-w-6xl p-6">
          <h1 className="text-2xl font-semibold text-stone-900">
            Rà soát Family Model
          </h1>
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Lỗi tải family_parents: {parentRowsError.message}
          </div>
        </main>
      );
    }

    familyParents = (parentRows ?? []) as FamilyParentRow[];

    for (const parent of familyParents) {
      personIds.add(parent.person_id);
    }
  }

  let people = new Map<string, PersonRow>();

  if (personIds.size > 0) {
    const { data: personRows, error: personRowsError } = await supabase
      .from("persons")
      .select("id, full_name")
      .in("id", Array.from(personIds));

    if (personRowsError) {
      return (
        <main className="mx-auto max-w-6xl p-6">
          <h1 className="text-2xl font-semibold text-stone-900">
            Rà soát Family Model
          </h1>
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Lỗi tải persons: {personRowsError.message}
          </div>
        </main>
      );
    }

    people = new Map(
      ((personRows ?? []) as PersonRow[]).map((person) => [person.id, person]),
    );
  }

  const parentsByFamilyId = new Map<string, string[]>();

  for (const parent of familyParents) {
    const parentName =
      people.get(parent.person_id)?.full_name || parent.person_id;

    const label =
      parent.role && parent.role !== "parent"
        ? `${parentName} (${parent.role})`
        : parentName;

    const list = parentsByFamilyId.get(parent.family_id) ?? [];
    list.push(label);
    parentsByFamilyId.set(parent.family_id, list);
  }

  const rows: ReviewRow[] = reviewChildren.map((row) => ({
    id: row.id,
    family_id: row.family_id,
    person_id: row.person_id,
    relationship_type: row.relationship_type,
    migration_confidence: row.migration_confidence,
    child_name: people.get(row.person_id)?.full_name ?? null,
    parents: parentsByFamilyId.get(row.family_id)?.join(" + ") ?? null,
  }));

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">
            Rà soát Family Model
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Danh sách con cái đang có trạng thái review. Nếu quan hệ cha mẹ -
            con là đúng, hãy đánh dấu đã xác nhận để chuyển sang manual.
          </p>
        </div>

        <Link
          href="/dashboard/data-maintenance"
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
        >
          Quay lại bảo trì
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
          Không còn case nào cần review. Family Model đã sạch ở nhóm này.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Cha mẹ</th>
                <th className="px-4 py-3 font-medium">Người con</th>
                <th className="px-4 py-3 font-medium">Loại quan hệ</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-800">
                    {row.parents || "Chưa rõ cha mẹ"}
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {row.child_name || row.person_id}
                  </td>
                  <td className="px-4 py-3 text-stone-700">
                    {row.relationship_type || "Không rõ"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                      {row.migration_confidence}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form
                      action={async () => {
                        "use server";
                        await confirmFamilyChildReview(row.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-700"
                      >
                        Đánh dấu đã xác nhận
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
