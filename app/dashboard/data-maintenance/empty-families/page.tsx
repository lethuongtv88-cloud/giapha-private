import { AlertTriangle, DatabaseZap } from "lucide-react";
import { getSupabase } from "@/utils/supabase/queries";
import { buildEmptyFamilyRows } from "@/services/data-maintenance/emptyFamilies.service";

export const metadata = {
  title: "Empty families maintenance",
};

function formatDate(input: string | null): string {
  if (!input) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(input));
}

export default async function EmptyFamiliesPage() {
  const supabase = await getSupabase();

  const [familiesRes, parentsRes, childrenRes] = await Promise.all([
    supabase
      .from("families")
      .select("id, status, created_at, updated_at, deleted_at")
      .is("deleted_at", null),

    supabase.from("family_parents").select("family_id"),

    supabase.from("family_children").select("family_id"),
  ]);

  const rows = buildEmptyFamilyRows({
    families: (familiesRes.data ?? []) as any,
    familyParents: (parentsRes.data ?? []) as any,
    familyChildren: (childrenRes.data ?? []) as any,
  });

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <h1 className="title">Empty families maintenance</h1>
        <p className="mt-1 text-sm text-stone-500">
          Liệt kê families active nhưng không có cha/mẹ và cũng không có con.
          Trang này chỉ preview, chưa xóa dữ liệu.
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-600" />
            <div>
              <h2 className="font-bold">Chế độ preview-only</h2>
              <p className="mt-1 text-sm">
                Empty family có thể là dữ liệu nháp, migration còn sót, hoặc
                family đang được tạo dở. Bước sau mới thêm soft-delete action có
                xác nhận.
              </p>
            </div>
          </div>
        </section>

        {familiesRes.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            Không tải được families: {familiesRes.error.message}
          </section>
        ) : null}

        {parentsRes.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            Không tải được family_parents: {parentsRes.error.message}
          </section>
        ) : null}

        {childrenRes.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            Không tải được family_children: {childrenRes.error.message}
          </section>
        ) : null}

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900">
                Empty active families
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Tổng: {rows.length} family.
              </p>
            </div>

            <DatabaseZap className="size-7 text-stone-400" />
          </div>

          {rows.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="px-3 py-2 font-semibold">Family ID</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Created</th>
                    <th className="px-3 py-2 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-stone-100">
                      <td className="px-3 py-3 font-mono text-xs text-stone-700">
                        {row.id}
                      </td>
                      <td className="px-3 py-3 text-stone-700">{row.status}</td>
                      <td className="px-3 py-3 text-stone-700">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-3 py-3 text-stone-700">
                        {formatDate(row.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
              Không phát hiện empty active families.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
