import Link from "next/link";
import { getSupabase } from "@/utils/supabase/queries";

export const dynamic = "force-dynamic";

type PersonRow = {
  id: string;
  full_name: string | null;
  birth_year: number | null;
  death_year: number | null;
};

type EventRow = {
  id: string;
  type: string;
  title: string | null;
  start_date: string | null;
  sort_date: string | null;
  person_id?: string | null;
  person_name?: string | null;
};

function eventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    birth: "Sinh",
    death: "Mất",
    death_anniversary: "Ngày giỗ",
    marriage: "Kết hôn",
    divorce: "Ly hôn",
    burial: "An táng",
    residence: "Cư trú",
    occupation: "Nghề nghiệp",
    migration: "Di cư",
    military: "Quân ngũ",
    custom: "Khác",
  };

  return labels[type] ?? type;
}

export default async function MissingSourcesPage() {
  const supabase = await getSupabase();

  const { data: persons } = await supabase
    .from("persons_active")
    .select("id, full_name, birth_year, death_year")
    .order("full_name", { ascending: true })
    .limit(1000);

  const { data: personLinks } = await supabase
    .from("person_source_links")
    .select("person_id")
    .is("deleted_at", null);

  const personIdsWithSource = new Set(
    (personLinks ?? []).map((row) => row.person_id).filter(Boolean),
  );

  const personsMissingSource = ((persons ?? []) as PersonRow[]).filter(
    (person) => !personIdsWithSource.has(person.id),
  );

  const { data: eventRows } = await supabase
    .from("events_active")
    .select("id, type, title, start_date, sort_date")
    .in("type", ["birth", "death", "marriage", "divorce"])
    .order("sort_date", { ascending: false })
    .limit(1000);

  const { data: eventLinks } = await supabase
    .from("event_source_links")
    .select("event_id")
    .is("deleted_at", null);

  const eventIdsWithSource = new Set(
    (eventLinks ?? []).map((row) => row.event_id).filter(Boolean),
  );

  const { data: personEvents } = await supabase
    .from("person_events")
    .select("event_id, person_id");

  const personByEventId = new Map<string, string>();
  for (const row of personEvents ?? []) {
    if (row.event_id && row.person_id && !personByEventId.has(row.event_id)) {
      personByEventId.set(row.event_id, row.person_id);
    }
  }

  const personNameById = new Map(
    ((persons ?? []) as PersonRow[]).map((person) => [
      person.id,
      person.full_name ?? "Không rõ tên",
    ]),
  );

  const importantEventsMissingSource = ((eventRows ?? []) as EventRow[])
    .filter((event) => !eventIdsWithSource.has(event.id))
    .map((event) => {
      const personId = personByEventId.get(event.id) ?? null;
      return {
        ...event,
        person_id: personId,
        person_name: personId ? personNameById.get(personId) ?? null : null,
      };
    });

  const birthMissing = importantEventsMissingSource.filter(
    (event) => event.type === "birth",
  );
  const deathMissing = importantEventsMissingSource.filter(
    (event) => event.type === "death",
  );
  const marriageMissing = importantEventsMissingSource.filter(
    (event) => event.type === "marriage",
  );
  const divorceMissing = importantEventsMissingSource.filter(
    (event) => event.type === "divorce",
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/dashboard/data-maintenance"
          className="text-sm font-medium text-amber-700 hover:text-amber-800"
        >
          ← Quay lại Data Maintenance
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-stone-900">
          Kiểm tra thiếu nguồn
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Danh sách người và sự kiện quan trọng chưa có nguồn xác minh.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Người chưa có nguồn" value={personsMissingSource.length} />
        <StatCard label="Sinh thiếu nguồn" value={birthMissing.length} />
        <StatCard label="Mất thiếu nguồn" value={deathMissing.length} />
        <StatCard label="Kết hôn thiếu nguồn" value={marriageMissing.length} />
        <StatCard label="Ly hôn thiếu nguồn" value={divorceMissing.length} />
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="font-semibold text-stone-900">Người chưa có nguồn</h2>
            <p className="mt-1 text-sm text-stone-500">
              Chỉ kiểm tra nguồn gắn trực tiếp vào người, không tính nguồn của sự kiện.
            </p>
          </div>

          {personsMissingSource.length === 0 ? (
            <p className="p-4 text-sm text-stone-500">Không có dữ liệu thiếu.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {personsMissingSource.slice(0, 200).map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-stone-900">
                      {person.full_name ?? "Không rõ tên"}
                    </div>
                    <div className="text-xs text-stone-500">
                      Sinh: {person.birth_year ?? "?"} · Mất:{" "}
                      {person.death_year ?? "?"}
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/members/${person.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Mở
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <MissingEventsSection title="Sự kiện Sinh thiếu nguồn" events={birthMissing} />
        <MissingEventsSection title="Sự kiện Mất thiếu nguồn" events={deathMissing} />
        <MissingEventsSection title="Sự kiện Kết hôn thiếu nguồn" events={marriageMissing} />
        <MissingEventsSection title="Sự kiện Ly hôn thiếu nguồn" events={divorceMissing} />
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-2xl font-bold text-stone-900">{value}</div>
      <div className="mt-1 text-sm text-stone-500">{label}</div>
    </div>
  );
}

function MissingEventsSection({
  title,
  events,
}: {
  title: string;
  events: EventRow[];
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="font-semibold text-stone-900">{title}</h2>
      </div>

      {events.length === 0 ? (
        <p className="p-4 text-sm text-stone-500">Không có dữ liệu thiếu.</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {events.slice(0, 200).map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <div className="font-medium text-stone-900">
                  {event.title || eventTypeLabel(event.type)}
                </div>
                <div className="text-xs text-stone-500">
                  {eventTypeLabel(event.type)}
                  {event.start_date ? ` · ${event.start_date}` : ""}
                  {event.person_name ? ` · ${event.person_name}` : ""}
                </div>
              </div>

              {event.person_id ? (
                <Link
                  href={`/dashboard/members/${event.person_id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Mở người
                </Link>
              ) : (
                <span className="text-xs text-stone-400">Không rõ người</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
