import type { Person, Relationship } from "@/types";
import RootStatsPanel from "@/components/RootStatsPanel";
import {
  calculateGlobalStats,
  type EventRow,
  type FamilyChildRow,
  type FamilyParentRow,
  type FamilyRow,
} from "@/services/statistics/globalStats.service";

interface FamilyStatsProps {
  persons: Person[];
  relationships: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
  events?: EventRow[];
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number | string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-stone-900">{value}</div>
      {description ? (
        <div className="mt-1 text-xs text-stone-400">{description}</div>
      ) : null}
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-stone-100 py-2 last:border-b-0">
      <span className="text-sm text-stone-600">{label}</span>
      <span className="text-sm font-semibold text-stone-900">{value}</span>
    </div>
  );
}

export default function FamilyStats({
  persons,
  relationships,
  families = [],
  familyParents = [],
  familyChildren = [],
  events = [],
}: FamilyStatsProps) {
  const stats = calculateGlobalStats({
    persons,
    relationships,
    families,
    familyParents,
    familyChildren,
    events,
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tổng thành viên"
          value={stats.totalPersons}
          description="Tất cả người đang active"
        />
        <StatCard
          label="Tổng gia đình"
          value={stats.totals.families}
          description="Theo Family Model"
        />
        <StatCard
          label="Tổng sự kiện"
          value={stats.totals.events}
          description="Theo Event Model"
        />
        <StatCard
          label="Có gia đình"
          value={stats.maritalStatus.married}
          description="Dựa trên family_parents"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-stone-900">
            Giới tính
          </h2>
          <div className="mt-3">
            <StatRow label="Nam" value={stats.gender.male} />
            <StatRow label="Nữ" value={stats.gender.female} />
            <StatRow label="Khác" value={stats.gender.other} />
            <StatRow label="Chưa rõ" value={stats.gender.unknown} />
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-stone-900">
            Tình trạng sinh tử
          </h2>
          <div className="mt-3">
            <StatRow label="Còn sống" value={stats.lifeStatus.living} />
            <StatRow label="Đã mất" value={stats.lifeStatus.deceased} />
            <StatRow label="Chưa rõ" value={stats.lifeStatus.unknown} />
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-stone-900">
            Tình trạng hôn nhân
          </h2>
          <div className="mt-3">
            <StatRow label="Có gia đình" value={stats.maritalStatus.married} />
            <StatRow label="Chưa có gia đình" value={stats.maritalStatus.unmarried} />
            <StatRow label="Chưa rõ" value={stats.maritalStatus.unknown} />
          </div>
          <p className="mt-3 text-xs text-stone-400">
            Không tính dâu/rễ tuyệt đối toàn gia phả. Dâu/rễ sẽ được tính riêng theo gốc đang chọn.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-stone-900">
            Tình trạng con cái
          </h2>
          <div className="mt-3">
            <StatRow label="Có con" value={stats.childStatus.hasChildren} />
            <StatRow label="Chưa có con" value={stats.childStatus.noChildren} />
            <StatRow label="Chưa rõ" value={stats.childStatus.unknown} />
          </div>
        </div>
      </section>
<RootStatsPanel
  persons={persons}
  relationships={relationships}
  families={families}
  familyParents={familyParents}
  familyChildren={familyChildren}
/>
    </div>
  );
}