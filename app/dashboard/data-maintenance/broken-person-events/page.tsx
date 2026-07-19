import Link from "next/link";
import { AlertTriangle, ArrowLeft, Link2Off, ShieldCheck } from "lucide-react";
import { getSupabase } from "@/utils/supabase/queries";
import { RepairBrokenPersonEventsButton } from "./RepairBrokenPersonEventsButton";

export const metadata = {
  title: "Repair broken person_events",
};

type BrokenPersonEvent = {
  id: string;
  person_id: string;
  event_id: string;
  reason: string;
};

async function loadBrokenPersonEvents() {
  const supabase = await getSupabase();

  const [personEventsRes, personsRes, eventsRes] = await Promise.all([
    supabase.from("person_events").select("id, person_id, event_id").limit(100000),
    supabase.from("persons").select("id, full_name").is("deleted_at", null).limit(100000),
    supabase.from("events").select("id, type, title, start_date").is("deleted_at", null).limit(100000),
  ]);

  if (personEventsRes.error || personsRes.error || eventsRes.error) {
    return {
      error:
        personEventsRes.error?.message ||
        personsRes.error?.message ||
        eventsRes.error?.message ||
        "Không tải được dữ liệu person_events.",
      items: [] as BrokenPersonEvent[],
    };
  }

  const activePersonIds = new Set((personsRes.data ?? []).map((row) => row.id));
  const activeEventIds = new Set((eventsRes.data ?? []).map((row) => row.id));

  const items = (personEventsRes.data ?? [])
    .filter((row) => !activePersonIds.has(row.person_id) || !activeEventIds.has(row.event_id))
    .map((row) => {
      const missingPerson = !activePersonIds.has(row.person_id);
      const missingEvent = !activeEventIds.has(row.event_id);

      return {
        id: row.id,
        person_id: row.person_id,
        event_id: row.event_id,
        reason:
          missingPerson && missingEvent
            ? "person và event không active"
            : missingPerson
              ? "person không active"
              : "event không active",
      };
    });

  return { error: null, items };
}

export default async function BrokenPersonEventsMaintenancePage() {
  const { error, items } = await loadBrokenPersonEvents();

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <Link
          href="/dashboard/data-maintenance"
          className="inline-flex items-center gap-2 text-sm font-semibold text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="size-4" />
          Quay lại Data maintenance
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <div className="rounded-2xl bg-red-50 p-3 text-red-700">
            <Link2Off className="size-6" />
          </div>
          <div>
            <h1 className="title">Broken person_events</h1>
            <p className="mt-1 text-sm text-stone-500">
              Repair các liên kết person_events trỏ tới person hoặc event không còn active.
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-emerald-600" />
            <div>
              <h2 className="font-bold">Repair an toàn</h2>
              <p className="mt-1 text-sm text-emerald-800">
                Thao tác này chỉ xóa dòng liên kết lỗi trong person_events. Sau đó, event nào không còn liên kết với người nào sẽ được soft-delete bằng deleted_at.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-stone-500">person_events lỗi</div>
            <div className="mt-2 text-3xl font-bold text-stone-900">{items.length}</div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 md:col-span-2">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div className="text-sm leading-relaxed">
                Nên backup database trước khi chạy repair. Sau khi repair xong, quay lại Data Quality để kiểm tra các lỗi person_events đã hết chưa.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900">Thao tác repair</h2>
          <p className="mt-1 text-sm text-stone-500">
            Chỉ quản trị viên mới chạy được thao tác này. Kết quả sẽ được ghi vào Audit Log.
          </p>
          <div className="mt-4">
            <RepairBrokenPersonEventsButton />
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900">Preview lỗi</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-stone-200">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">person_event</th>
                  <th className="px-4 py-3">person_id</th>
                  <th className="px-4 py-3">event_id</th>
                  <th className="px-4 py-3">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {items.slice(0, 100).map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">{item.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">{item.person_id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">{item.event_id}</td>
                    <td className="px-4 py-3 text-stone-700">{item.reason}</td>
                  </tr>
                ))}

                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                      Không phát hiện person_events lỗi.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {items.length > 100 ? (
            <p className="mt-3 text-xs text-stone-500">
              Đang hiển thị 100 lỗi đầu tiên trong tổng số {items.length} lỗi.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
