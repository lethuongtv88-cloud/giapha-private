import Link from "next/link";
import {
  CalendarDays,
  DatabaseZap,
  Link2Off,
  ShieldCheck,
  UserRoundX,
  Wrench,
  Activity,
  GitBranch,
  Terminal,
} from "lucide-react";
import { DataMaintenanceShortcuts } from "@/components/AdminMaintenanceShortcuts";
import { getSupabase } from "@/utils/supabase/queries";

export const metadata = {
  title: "Data maintenance",
};

type ToolCardProps = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  count?: number | null;
  tone?: "stone" | "emerald" | "amber" | "red" | "indigo";
};

function toneClass(tone: ToolCardProps["tone"]) {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "red") return "border-red-200 bg-red-50 text-red-900";
  if (tone === "indigo") return "border-indigo-200 bg-indigo-50 text-indigo-900";
  return "border-stone-200 bg-white text-stone-900";
}

function ToolCard({
  title,
  description,
  href,
  icon,
  count,
  tone = "stone",
}: ToolCardProps) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass(
        tone,
      )}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm opacity-75">{description}</p>
        </div>

        <div className="rounded-xl bg-white/70 p-3">{icon}</div>
      </div>

      {typeof count === "number" ? (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wide opacity-60">
            Current count
          </div>
          <div className="mt-1 text-3xl font-bold">{count}</div>
        </div>
      ) : null}
    </Link>
  );
}


async function countBrokenPersonEvents(supabase: Awaited<ReturnType<typeof getSupabase>>) {
  const [personEventsRes, personsRes, eventsRes] = await Promise.all([
    supabase.from("person_events").select("id, person_id, event_id").limit(100000),
    supabase.from("persons").select("id").is("deleted_at", null).limit(100000),
    supabase.from("events").select("id").is("deleted_at", null).limit(100000),
  ]);

  if (personEventsRes.error || personsRes.error || eventsRes.error) {
    return { count: 0, error: true };
  }

  const activePersonIds = new Set((personsRes.data ?? []).map((row) => row.id));
  const activeEventIds = new Set((eventsRes.data ?? []).map((row) => row.id));

  return {
    count: (personEventsRes.data ?? []).filter((row) => {
      return !activePersonIds.has(row.person_id) || !activeEventIds.has(row.event_id);
    }).length,
    error: false,
  };
}

async function countMissingSources(supabase: Awaited<ReturnType<typeof getSupabase>>) {
  const [personsRes, personLinksRes, eventsRes, eventLinksRes] = await Promise.all([
    supabase.from("persons").select("id").is("deleted_at", null).limit(100000),
    supabase.from("person_source_links").select("person_id").is("deleted_at", null).limit(100000),
    supabase
      .from("events")
      .select("id, type")
      .is("deleted_at", null)
      .in("type", ["birth", "death", "marriage", "divorce"])
      .limit(100000),
    supabase.from("event_source_links").select("event_id").is("deleted_at", null).limit(100000),
  ]);

  if (personsRes.error || personLinksRes.error || eventsRes.error || eventLinksRes.error) {
    return { count: 0, error: true };
  }

  const personIdsWithSource = new Set(
    (personLinksRes.data ?? []).map((row) => row.person_id).filter(Boolean),
  );

  const eventIdsWithSource = new Set(
    (eventLinksRes.data ?? []).map((row) => row.event_id).filter(Boolean),
  );

  const personsMissingSource = (personsRes.data ?? []).filter(
    (person) => !personIdsWithSource.has(person.id),
  ).length;

  const importantEventsMissingSource = (eventsRes.data ?? []).filter(
    (event) => !eventIdsWithSource.has(event.id),
  ).length;

  return {
    count: personsMissingSource + importantEventsMissingSource,
    error: false,
  };
}


async function countDataCompletenessIssues(supabase: Awaited<ReturnType<typeof getSupabase>>) {
  const personsRes = await supabase
    .from("persons")
    .select("id, full_name, gender, birth_year, death_year, death_lunar_year, death_lunar_month, death_lunar_day, is_deceased")
    .is("deleted_at", null)
    .limit(100000);

  if (personsRes.error) {
    return { count: 0, error: true };
  }

  const persons = personsRes.data ?? [];

  const isBlankName = (name: string | null) => {
    const value = (name ?? "").trim().toLowerCase();
    return !value || value === "unknown" || value === "chưa rõ tên";
  };

  const hasDeathAnniversary = (person: {
    death_lunar_year: number | null;
    death_lunar_month: number | null;
    death_lunar_day: number | null;
  }) => {
    return Boolean(
      person.death_lunar_year ||
        person.death_lunar_month ||
        person.death_lunar_day,
    );
  };

  const count = persons.filter((person) => {
    return (
      isBlankName(person.full_name) ||
      !person.birth_year ||
      (person.is_deceased && !person.death_year) ||
      (person.is_deceased && !hasDeathAnniversary(person)) ||
      !person.gender ||
      !["male", "female", "other"].includes(person.gender)
    );
  }).length;

  return { count, error: false };
}


export default async function DataMaintenancePage() {
  const supabase = await getSupabase();

  const [
    unknownRes,
    missingLinksRes,
    emptyFamiliesRes,
    brokenPersonEventsRes,
    missingSourcesRes,
    dataCompletenessRes,
  ] = await Promise.all([
      supabase
        .from("persons")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("full_name", ["Unknown", "Chưa rõ tên"]),

      supabase.rpc("count_events_without_person_events"),

      supabase.rpc("count_active_empty_families"),

      countBrokenPersonEvents(supabase),
      countMissingSources(supabase),
      countDataCompletenessIssues(supabase),
    ]);

  const unknownCount = unknownRes.count ?? 0;
  const missingLinksCount =
    typeof missingLinksRes.data?.count === "number" ? missingLinksRes.data.count : 0;
  const emptyFamiliesCount =
    typeof emptyFamiliesRes.data?.count === "number" ? emptyFamiliesRes.data.count : 0;
  const brokenPersonEventsCount = brokenPersonEventsRes.count;
  const missingSourcesCount = missingSourcesRes.count;
  const dataCompletenessCount = dataCompletenessRes.count;

  return (
    <div className="flex-1 w-full relative flex flex-col pb-12">
      <div className="w-full relative z-20 py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <h1 className="title">Data maintenance</h1>
        <p className="mt-1 text-sm text-stone-500">
          Các công cụ kiểm tra và sửa dữ liệu sau migration/import. Ưu tiên
          preview trước, chỉ repair khi có xác nhận.
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-6">
        <DataMaintenanceShortcuts />

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-emerald-600" />
            <div>
              <h2 className="font-bold">Nguyên tắc an toàn</h2>
              <p className="mt-1 text-sm text-emerald-800">
                Các trang maintenance mặc định là preview-only. Những thao tác
                repair thật đều có confirm và dùng cơ chế chống duplicate.
              </p>
            </div>
          </div>
        </section>

        {(unknownRes.error || missingLinksRes.error || emptyFamiliesRes.error || brokenPersonEventsRes.error) ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Một số chỉ số chưa tải được. Nếu mới tạo RPC audit, hãy chắc chắn đã
            chạy migration audit RPCs trong Supabase.
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          <ToolCard
            title="Unknown persons"
            description="Liệt kê người active có tên Unknown/Chưa rõ tên để mở hồ sơ và sửa."
            href="/dashboard/data-maintenance/unknown-persons"
            icon={<UserRoundX className="size-6" />}
            count={unknownCount}
            tone={unknownCount > 0 ? "amber" : "emerald"}
          />

          <ToolCard
            title="Duplicate events"
            description="Preview birth/death events bị trùng theo person, type và ngày."
            href="/dashboard/data-maintenance/duplicate-events"
            icon={<CalendarDays className="size-6" />}
            tone="stone"
          />

          <ToolCard
            title="Missing sources"
            description="Kiểm tra người và sự kiện quan trọng chưa có nguồn xác minh."
            href="/dashboard/data-maintenance/missing-sources"
            icon={<DatabaseZap className="size-6" />}
            count={missingSourcesCount}
            tone={missingSourcesCount > 0 ? "amber" : "emerald"}
          />

          <ToolCard
            title="Data completeness"
            description="Kiểm tra người thiếu tên, giới tính, năm sinh, năm mất hoặc ngày giỗ."
            href="/dashboard/data-maintenance/data-completeness"
            icon={<Wrench className="size-6" />}
            count={dataCompletenessCount}
            tone={dataCompletenessCount > 0 ? "amber" : "emerald"}
          />

          <ToolCard
            title="Events missing links"
            description="Tìm và repair birth/death events thiếu person_events link."
            href="/dashboard/data-maintenance/events-missing-links"
            icon={<Link2Off className="size-6" />}
            count={missingLinksCount}
            tone={missingLinksCount > 0 ? "amber" : "emerald"}
          />

          <ToolCard
            title="Broken person_events"
            description="Xóa liên kết person_events trỏ tới person/event không active và soft-delete event mồ côi."
            href="/dashboard/data-maintenance/broken-person-events"
            icon={<Link2Off className="size-6" />}
            count={brokenPersonEventsCount}
            tone={brokenPersonEventsCount > 0 ? "red" : "emerald"}
          />

          <ToolCard
            title="Empty families"
            description="Theo dõi families active không có parents và children. Trang chi tiết sẽ làm ở bước sau."
            href="/dashboard/data-maintenance/empty-families"
            icon={<DatabaseZap className="size-6" />}
            count={emptyFamiliesCount}
            tone={emptyFamiliesCount > 0 ? "amber" : "emerald"}
          />

          <ToolCard
            title="Backup database"
            description="Xem danh sách backup, chạy backup ngay, tải xuống, xóa bản cũ và cấu hình số bản cần giữ."
            href="/dashboard/data-maintenance/backups"
            icon={<Activity className="size-6" />}
            tone="indigo"
          />

          <ToolCard
            title="Rà soát Family Model"
            description="Xem và xác nhận các quan hệ cha mẹ - con còn ở trạng thái review sau migration."
            href="/dashboard/data-maintenance/migration-review"
            icon={<GitBranch className="size-6" />}
            tone="amber"
          />

          <ToolCard
            title="Family Model nâng cao"
            description="Audit và repair missing marriage/child Family Model, duplicate parent/child và cấu trúc family bất thường."
            href="/dashboard/data-maintenance/family-model"
            icon={<Wrench className="size-6" />}
            tone="indigo"
          />

          <ToolCard
            title="SQL Console"
            description="Chạy trực tiếp SQL repair vào database, không cần vào Supabase SQL Editor. Chỉ dành cho admin."
            href="/dashboard/data-maintenance/sql-console"
            icon={<Terminal className="size-6" />}
            tone="red"
          />
        </section>
        
      </main>
    </div>
  );
}
