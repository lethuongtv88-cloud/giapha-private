import Link from "next/link";
import {
  CalendarDays,
  DatabaseZap,
  Link2Off,
  ShieldCheck,
  UserRoundX,
  Wrench,
  Activity,
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

export default async function DataMaintenancePage() {
  const supabase = await getSupabase();

  const [unknownRes, missingLinksRes, emptyFamiliesRes, brokenPersonEventsRes] =
    await Promise.all([
      supabase
        .from("persons")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("full_name", ["Unknown", "Chưa rõ tên"]),

      supabase.rpc("count_events_without_person_events"),

      supabase.rpc("count_active_empty_families"),

      countBrokenPersonEvents(supabase),
    ]);

  const unknownCount = unknownRes.count ?? 0;
  const missingLinksCount =
    typeof missingLinksRes.data?.count === "number" ? missingLinksRes.data.count : 0;
  const emptyFamiliesCount =
    typeof emptyFamiliesRes.data?.count === "number" ? emptyFamiliesRes.data.count : 0;
  const brokenPersonEventsCount = brokenPersonEventsRes.count;

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
            title="Family Model nâng cao"
            description="Audit và repair missing marriage/child Family Model, duplicate parent/child và cấu trúc family bất thường."
            href="/dashboard/data-maintenance/family-model"
            icon={<Wrench className="size-6" />}
            tone="indigo"
          />
        </section>
        
      </main>
    </div>
  );
}
