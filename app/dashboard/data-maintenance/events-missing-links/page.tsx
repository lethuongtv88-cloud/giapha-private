import Link from "next/link";
import { AlertTriangle, Link2Off, Eye } from "lucide-react";
import { getSupabase } from "@/utils/supabase/queries";
import { buildEventsMissingLinksRows } from "@/services/data-maintenance/eventsMissingLinks.service";

export const metadata = {
  title: "Events missing links maintenance",
};

export default async function EventsMissingLinksPage() {
  const supabase = await getSupabase();

  const [eventsRes, personEventsRes, personsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, type, legacy_person_id, start_date, end_date, sort_date, deleted_at")
      .in("type", ["birth", "death"])
      .is("deleted_at", null)
      .not("legacy_person_id", "is", null),

    supabase
      .from("person_events")
      .select("person_id, event_id, role"),

    supabase
      .from("persons")
      .select("id, full_name")
      .is("deleted_at", null),
  ]);

  const rows = buildEventsMissingLinksRows({
    events: (eventsRes.data ?? []) as any,
    personEvents: (personEventsRes.data ?? []) as any,
    persons: (personsRes.data ?? []) as any,
  });

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <h1 className="title">Events missing links maintenance</h1>
        <p className="mt-1 text-sm text-stone-500">
          Liệt kê birth/death events có legacy_person_id nhưng thiếu link trong
          person_events. Trang này chỉ preview, chưa sửa dữ liệu.
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-600" />
            <div>
              <h2 className="font-bold">Chế độ preview-only</h2>
              <p className="mt-1 text-sm">
                Nếu có missing links thật, bước sau mới thêm repair action có
                xác nhận để insert person_events còn thiếu.
              </p>
            </div>
          </div>
        </section>

        {eventsRes.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            Không tải được events: {eventsRes.error.message}
          </section>
        ) : null}

        {personEventsRes.error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            Không tải được person_events: {personEventsRes.error.message}
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
                Events thiếu person_events link
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Tổng: {rows.length} event.
              </p>
            </div>

            <Link2Off className="size-7 text-stone-400" />
          </div>

          {rows.length > 0 ? (
            <div className="mt-5 space-y-3">
              {rows.map((row) => (
                <div
                  key={`${row.personId}:${row.eventId}`}
                  className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                          missing link
                        </span>
                        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-bold text-stone-700">
                          {row.type}
                        </span>
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
                          role: {row.role}
                        </span>
                      </div>

                      <div className="mt-2 font-bold text-stone-900">
                        {row.personName}
                      </div>

                      <div className="mt-1 grid gap-1 text-sm text-stone-600 sm:grid-cols-3">
                        <div>Start: {row.startDate ?? "—"}</div>
                        <div>End: {row.endDate ?? "—"}</div>
                        <div>Sort: {row.sortDate ?? "—"}</div>
                      </div>

                      <div className="mt-2 font-mono text-xs text-stone-400">
                        Event: {row.eventId}
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/members/${row.personId}`}
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
              Không phát hiện birth/death events thiếu person_events link.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
