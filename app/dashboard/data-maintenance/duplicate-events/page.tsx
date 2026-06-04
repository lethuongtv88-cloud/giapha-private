import Link from "next/link";
import { AlertTriangle, CalendarDays, Eye } from "lucide-react";
import { getSupabase } from "@/utils/supabase/queries";
import { buildDuplicateEventGroups } from "@/services/data-maintenance/duplicateEvents.service";

export const metadata = {
  title: "Duplicate events maintenance",
};

export default async function DuplicateEventsPage() {
  const supabase = await getSupabase();

  const [eventsRes, personsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, type, legacy_person_id, start_date, sort_date, deleted_at")
      .in("type", ["birth", "death"])
      .is("deleted_at", null),

    supabase
      .from("persons")
      .select("id, full_name")
      .is("deleted_at", null),
  ]);

  const groups = buildDuplicateEventGroups({
    events: (eventsRes.data ?? []) as any,
    persons: (personsRes.data ?? []) as any,
  });

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <h1 className="title">Duplicate events maintenance</h1>
        <p className="mt-1 text-sm text-stone-500">
          Liệt kê birth/death events bị trùng theo person, type, start_date và sort_date.
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
                Nếu có duplicate thật, bước sau mới làm soft-delete duplicate có review.
              </p>
            </div>
          </div>
        </section>

        {eventsRes.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            Không tải được events: {eventsRes.error.message}
          </section>
        ) : null}

        {personsRes.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            Không tải được persons: {personsRes.error.message}
          </section>
        ) : null}

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900">
                Nhóm event trùng
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Tổng: {groups.length} nhóm.
              </p>
            </div>

            <CalendarDays className="size-7 text-stone-400" />
          </div>

          {groups.length > 0 ? (
            <div className="mt-5 space-y-3">
              {groups.map((group) => (
                <div
                  key={`${group.personId}:${group.type}:${group.startDate}:${group.sortDate}`}
                  className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                          duplicate x{group.count}
                        </span>
                        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-bold text-stone-700">
                          {group.type}
                        </span>
                      </div>

                      <div className="mt-2 font-bold text-stone-900">
                        {group.personName}
                      </div>

                      <div className="mt-1 grid gap-1 text-sm text-stone-600 sm:grid-cols-2">
                        <div>Start: {group.startDate ?? "—"}</div>
                        <div>Sort: {group.sortDate ?? "—"}</div>
                      </div>

                      <div className="mt-2 font-mono text-xs text-stone-400">
                        {group.eventIds.join(", ")}
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/members/${group.personId}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
                    >
                      <Eye className="size-4" />
                      Mở person
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
              Không phát hiện duplicate birth/death events.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
