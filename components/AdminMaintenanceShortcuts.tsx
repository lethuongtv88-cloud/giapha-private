import type { ComponentType } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  DatabaseZap,
  FileWarning,
  GitPullRequestArrow,
  Link2Off,
  ShieldCheck,
  UsersRound,
  Wrench,
} from "lucide-react";

type ShortcutTone = "stone" | "emerald" | "amber" | "red" | "indigo" | "sky";

type ShortcutItem = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  tone?: ShortcutTone;
};

function toneClass(tone: ShortcutTone = "stone") {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300";
  if (tone === "red") return "border-red-200 bg-red-50 text-red-900 hover:border-red-300";
  if (tone === "indigo") return "border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300";
  if (tone === "sky") return "border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300";
  return "border-stone-200 bg-white text-stone-900 hover:border-stone-300";
}

function ShortcutGrid({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: ShortcutItem[];
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <p className="mt-1 text-sm text-stone-500">{description}</p>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          {items.length} lối tắt
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${toneClass(
                item.tone,
              )}`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white/75 p-2.5 shadow-sm">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold leading-tight">{item.title}</h3>
                    {item.badge ? (
                      <span className="rounded-full bg-white/75 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide opacity-75">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed opacity-75">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function AdminHealthShortcuts() {
  return (
    <ShortcutGrid
      title="Bảng lối tắt Admin Health"
      description="Mở nhanh các khu vực kiểm tra sức khỏe hệ thống, dữ liệu, import và nhật ký quản trị."
      items={[
        {
          title: "Data Quality",
          description: "Xem toàn bộ lỗi/cảnh báo về Family Model, Event Model, tree, stats và legacy data.",
          href: "/dashboard/data-quality",
          icon: AlertTriangle,
          tone: "amber",
        },
        {
          title: "Data Maintenance",
          description: "Các công cụ repair an toàn sau migration/import.",
          href: "/dashboard/data-maintenance",
          icon: Wrench,
          tone: "stone",
        },
        {
          title: "Family Model Quality",
          description: "Kiểm tra families, family_parents, family_children nâng cao.",
          href: "/dashboard/data-quality/family-model",
          icon: DatabaseZap,
          tone: "indigo",
        },
        {
          title: "Broken person_events",
          description: "Repair liên kết person_events trỏ tới person/event không active.",
          href: "/dashboard/data-maintenance/broken-person-events",
          icon: Link2Off,
          tone: "red",
        },
        {
          title: "GEDCOM Import",
          description: "Theo dõi import sessions, staging và merge suggestions.",
          href: "/dashboard/import",
          icon: GitPullRequestArrow,
          tone: "indigo",
        },
        {
          title: "Audit Log",
          description: "Xem lịch sử thao tác admin, repair, import và thay đổi dữ liệu.",
          href: "/dashboard/audit-log",
          icon: Activity,
          tone: "sky",
        },
        {
          title: "Users / Permission",
          description: "Quản lý user, role, person_id và root mặc định.",
          href: "/dashboard/users",
          icon: UsersRound,
          tone: "emerald",
        },
        {
          title: "Events Health",
          description: "Kiểm tra danh sách sự kiện, countdown, kết hôn, giỗ và sinh nhật.",
          href: "/dashboard/events",
          icon: CalendarDays,
          tone: "sky",
        },
        {
          title: "Thống kê",
          description: "Kiểm tra số liệu gia phả và thống kê theo root hiện tại.",
          href: "/dashboard/stats",
          icon: Activity,
          tone: "stone",
        },
      ]}
    />
  );
}

export function DataMaintenanceShortcuts() {
  return (
    <ShortcutGrid
      title="Bảng lối tắt Bảo trì dữ liệu"
      description="Chọn nhanh công cụ kiểm tra/repair. Các thao tác sửa dữ liệu đều cần xác nhận trước khi chạy."
      items={[
        {
          title: "Unknown persons",
          description: "Liệt kê người active còn tên Unknown/Chưa rõ tên để mở hồ sơ và sửa.",
          href: "/dashboard/data-maintenance/unknown-persons",
          icon: UsersRound,
          tone: "amber",
        },
        {
          title: "Duplicate events",
          description: "Preview birth/death events bị trùng theo person, type và ngày.",
          href: "/dashboard/data-maintenance/duplicate-events",
          icon: FileWarning,
          tone: "amber",
        },
        {
          title: "Events missing links",
          description: "Repair birth/death events thiếu person_events link.",
          href: "/dashboard/data-maintenance/events-missing-links",
          icon: Link2Off,
          tone: "amber",
        },
        {
          title: "Broken person_events",
          description: "Xóa link person_events lỗi và soft-delete event mồ côi.",
          href: "/dashboard/data-maintenance/broken-person-events",
          icon: Link2Off,
          tone: "red",
        },
        {
          title: "Empty families",
          description: "Preview families active không có cha/mẹ và cũng không có con.",
          href: "/dashboard/data-maintenance/empty-families",
          icon: DatabaseZap,
          tone: "amber",
        },
        {
          title: "Family Model maintenance",
          description: "Repair missing marriage/child Family Model và xem SQL nâng cao.",
          href: "/dashboard/data-maintenance/family-model",
          icon: Wrench,
          tone: "indigo",
        },
        {
          title: "Data Quality",
          description: "Quay sang trang tổng kiểm tra chất lượng dữ liệu.",
          href: "/dashboard/data-quality",
          icon: ShieldCheck,
          tone: "emerald",
        },
        {
          title: "Admin Health",
          description: "Quay sang bảng health tổng quan của admin.",
          href: "/dashboard/admin-health",
          icon: Activity,
          tone: "sky",
        },
        {
          title: "Audit Log",
          description: "Kiểm tra lịch sử repair và thao tác dữ liệu.",
          href: "/dashboard/audit-log",
          icon: Activity,
          tone: "stone",
        },
      ]}
    />
  );
}

export function DataQualityShortcuts() {
  return (
    <ShortcutGrid
      title="Bảng lối tắt Data Quality"
      description="Đi nhanh tới các trang quality/maintenance liên quan khi cần xử lý vấn đề."
      items={[
        {
          title: "Family Model Quality",
          description: "Kiểm tra nâng cao các lỗi family, parent/child và relationship.",
          href: "/dashboard/data-quality/family-model",
          icon: DatabaseZap,
          tone: "indigo",
        },
        {
          title: "Data Maintenance",
          description: "Mở trung tâm repair dữ liệu.",
          href: "/dashboard/data-maintenance",
          icon: Wrench,
          tone: "stone",
        },
        {
          title: "Broken person_events",
          description: "Repair person_events không còn person/event active.",
          href: "/dashboard/data-maintenance/broken-person-events",
          icon: Link2Off,
          tone: "red",
        },
        {
          title: "Events missing links",
          description: "Repair birth/death event thiếu person_events link.",
          href: "/dashboard/data-maintenance/events-missing-links",
          icon: Link2Off,
          tone: "amber",
        },
        {
          title: "Admin Health",
          description: "Xem health tổng quan.",
          href: "/dashboard/admin-health",
          icon: Activity,
          tone: "sky",
        },
        {
          title: "Audit Log",
          description: "Xem lịch sử thao tác và repair.",
          href: "/dashboard/audit-log",
          icon: Activity,
          tone: "stone",
        },
      ]}
    />
  );
}

export function BackToDataMaintenance({ label = "Trở về Bảo trì dữ liệu" }: { label?: string }) {
  return (
    <Link
      href="/dashboard/data-maintenance"
      className="mb-4 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 shadow-sm hover:bg-stone-50 hover:text-stone-900"
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}

export function BackToDataQuality({ label = "Trở về Data Quality" }: { label?: string }) {
  return (
    <Link
      href="/dashboard/data-quality"
      className="mb-4 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 shadow-sm hover:bg-stone-50 hover:text-stone-900"
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}
