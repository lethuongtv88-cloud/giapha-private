import Link from "next/link";
import { AlertTriangle, DatabaseZap, Wrench } from "lucide-react";
import { getSupabase } from "@/utils/supabase/queries";
import {
  familyModelRepairSql,
  runFamilyModelQualityChecks,
} from "@/services/data-quality/familyModelQuality.service";

export const metadata = {
  title: "Family Model maintenance",
};

function SqlBlock({ title, sql }: { title: string; sql: string }) {
  return (
    <details className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <summary className="cursor-pointer text-sm font-bold text-stone-800">
        {title}
      </summary>
      <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-stone-950 p-4 text-xs leading-relaxed text-stone-100">
        <code>{sql}</code>
      </pre>
    </details>
  );
}

export default async function FamilyModelMaintenancePage() {
  const supabase = await getSupabase();

  const [personsRes, relationshipsRes, familiesRes, parentsRes, childrenRes] =
    await Promise.all([
      supabase.from("persons").select("id, full_name, gender, deleted_at"),
      supabase
        .from("relationships")
        .select("id, type, person_a, person_b, deleted_at, created_at"),
      supabase.from("families").select("id, status, deleted_at, created_at, updated_at"),
      supabase.from("family_parents").select("id, family_id, person_id, role, sort_order"),
      supabase
        .from("family_children")
        .select("id, family_id, person_id, relationship_type, sort_order, legacy_relationship_id, migration_confidence"),
    ]);

  const result = runFamilyModelQualityChecks({
    persons: (personsRes.data ?? []) as any,
    relationships: (relationshipsRes.data ?? []) as any,
    families: (familiesRes.data ?? []) as any,
    familyParents: (parentsRes.data ?? []) as any,
    familyChildren: (childrenRes.data ?? []) as any,
  });

  const safeRepairCount =
    result.summary.byKind.missing_marriage_family +
    result.summary.byKind.missing_child_family;

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <h1 className="title">Family Model maintenance</h1>
        <p className="mt-1 text-sm text-stone-500">
          Trang tập trung các repair an toàn cho families, family_parents và
          family_children. Mặc định vẫn là preview/SQL thủ công để tránh sửa nhầm.
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-600" />
            <div>
              <h2 className="font-bold">Repair có kiểm soát</h2>
              <p className="mt-1 text-sm">
                Chỉ hai nhóm missing marriage/missing child được xem là repair an
                toàn bằng RPC. Các nhóm duplicate/empty cần preview và xác nhận.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-stone-500">Tổng vấn đề</div>
            <div className="mt-2 text-3xl font-bold text-stone-900">
              {result.summary.total}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm text-emerald-800">
            <div className="text-sm opacity-80">Có thể repair an toàn</div>
            <div className="mt-2 text-3xl font-bold">{safeRepairCount}</div>
          </div>
          <Link
            href="/dashboard/data-quality/family-model"
            className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm text-sky-800 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <DatabaseZap className="size-7" />
            <div className="mt-3 font-bold">Mở audit chi tiết</div>
            <div className="mt-1 text-sm opacity-80">Xem từng issue và entity liên quan.</div>
          </Link>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex gap-3">
            <Wrench className="mt-0.5 size-6 shrink-0 text-stone-500" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-stone-900">SQL repair / preview</h2>
              <p className="mt-1 text-sm text-stone-500">
                Copy từng block vào Supabase SQL Editor. Nên backup trước khi chạy repair.
              </p>
              <div className="mt-4 space-y-3">
                <SqlBlock title="Repair missing marriage Family Model" sql={familyModelRepairSql.missingMarriage} />
                <SqlBlock title="Repair missing child Family Model" sql={familyModelRepairSql.missingChild} />
                <SqlBlock title="Preview duplicate family_parents" sql={familyModelRepairSql.duplicateParentsPreview} />
                <SqlBlock title="Preview duplicate family_children" sql={familyModelRepairSql.duplicateChildrenPreview} />
                <SqlBlock title="Preview empty active families" sql={familyModelRepairSql.emptyFamiliesPreview} />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
