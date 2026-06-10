import Link from "next/link";
import { AlertTriangle, Pencil, UserRoundX } from "lucide-react";
import { getSupabase } from "@/utils/supabase/queries";
import { buildUnknownPersonRows } from "@/services/data-maintenance/unknownPersons.service";
import { BackToDataMaintenance } from "@/components/AdminMaintenanceShortcuts";

export const metadata = {
  title: "Unknown persons maintenance",
};

function formatDate(input: string | null): string {
  if (!input) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(input));
}

export default async function UnknownPersonsPage() {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("persons")
    .select(
      "id, full_name, gender, birth_year, birth_month, birth_day, created_at, updated_at, deleted_at",
    )
    .is("deleted_at", null)
    .in("full_name", ["Unknown", "Chưa rõ tên"])
    .order("created_at", { ascending: false });

  const rows = buildUnknownPersonRows((data ?? []) as any);

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <BackToDataMaintenance />
        <h1 className="title">Unknown persons maintenance</h1>
        <p className="mt-1 text-sm text-stone-500">
          Quản lý người thật nhưng chưa biết tên. Trang này chỉ liệt kê và dẫn
          sang trang sửa person, không tự sửa dữ liệu.
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-600" />
            <div>
              <h2 className="font-bold">Ghi chú</h2>
              <p className="mt-1 text-sm">
                Nếu đây là người thật trong gia phả nhưng chưa biết tên, có thể
                giữ lại. Khi biết tên, bấm “Sửa” để cập nhật hồ sơ.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            Không tải được danh sách: {error.message}
          </section>
        ) : null}

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900">
                Danh sách chưa rõ tên
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Tổng: {rows.length} người active.
              </p>
            </div>

            <UserRoundX className="size-7 text-stone-400" />
          </div>

          {rows.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="px-3 py-2 font-semibold">Tên hiện tại</th>
                    <th className="px-3 py-2 font-semibold">Giới tính</th>
                    <th className="px-3 py-2 font-semibold">Sinh</th>
                    <th className="px-3 py-2 font-semibold">Tạo lúc</th>
                    <th className="px-3 py-2 font-semibold">Gợi ý tên tạm</th>
                    <th className="px-3 py-2 font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-stone-100">
                      <td className="px-3 py-3 font-semibold text-stone-900">
                        {row.fullName}
                        <div className="mt-1 font-mono text-xs font-normal text-stone-400">
                          {row.id}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-stone-700">
                        {row.gender}
                      </td>
                      <td className="px-3 py-3 text-stone-700">
                        {row.birthText}
                      </td>
                      <td className="px-3 py-3 text-stone-700">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-3 py-3 text-stone-700">
                        {row.suggestedName}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/dashboard/members/${row.id}/edit`}
                          className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                        >
                          <Pencil className="size-3" />
                          Sửa
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
              Không còn người active tên Unknown/Chưa rõ tên.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
