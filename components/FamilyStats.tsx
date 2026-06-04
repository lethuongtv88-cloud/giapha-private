"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { Person, Relationship } from "@/types";
import { getZodiacAnimal, getZodiacSign } from "@/utils/dateHelpers";
import {
  calculateGlobalStats,
  type EventRow,
  type FamilyChildRow,
  type FamilyParentRow,
  type FamilyRow,
} from "@/services/statistics/globalStats.service";
import {
  calculateRootStats,
  type RootStatsResult,
} from "@/services/statistics/rootStats.service";
import { motion } from "framer-motion";
import {
  Baby,
  Crown,
  Flower2,
  GitBranch,
  Heart,
  HeartOff,
  Mars,
  Moon,
  Skull,
  Sparkles,
  Star,
  Users,
  Venus,
} from "lucide-react";

interface FamilyStatsProps {
  persons: Person[];
  relationships: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
  events?: EventRow[];
}

interface StatCardProps {
  label: string;
  value: number;
  total: number;
  icon: ReactNode;
  color: string;
  delay?: number;
}

interface BreakdownItem {
  name: string;
  count: number;
}

function getDisplayName(person: Person): string {
  return person.full_name || person.id;
}

function StatCard({
  label,
  value,
  total,
  icon,
  color,
  delay = 0,
}: StatCardProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white/80 border border-stone-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
    >
      <div
        className={`absolute -top-6 -right-6 size-24 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity ${color}`}
      />

      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className={`p-2.5 rounded-xl ${color} bg-opacity-10`}>{icon}</div>
        <span className="text-xs font-semibold text-stone-400 bg-stone-100 px-2 py-1 rounded-full">
          {pct}%
        </span>
      </div>

      <p className="text-3xl font-bold text-stone-800 relative z-10">{value}</p>
      <p className="text-sm font-medium text-stone-500 mt-0.5 relative z-10">
        {label}
      </p>

      <div className="mt-3 h-1.5 bg-stone-100 rounded-full overflow-hidden relative z-10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: delay + 0.2, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </motion.div>
  );
}

function GenerationRow({
  gen,
  count,
  max,
  delay,
}: {
  gen: number;
  count: number;
  max: number;
  delay: number;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-stone-500 w-14 shrink-0">
        Đời {gen}
      </span>
      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay, ease: "easeOut" }}
          className="h-full bg-amber-400 rounded-full"
        />
      </div>
      <span className="text-sm font-bold text-stone-700 w-8 text-right shrink-0">
        {count}
      </span>
    </div>
  );
}

function BreakdownPanel({
  title,
  icon,
  items,
  total,
  barColor,
  delay,
  note,
}: {
  title: string;
  icon: ReactNode;
  items: BreakdownItem[];
  total: number;
  barColor: string;
  delay: number;
  note: string;
}) {
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white/80 border border-stone-200/60 rounded-2xl p-6 shadow-sm"
    >
      <h2 className="text-base font-bold text-stone-700 mb-5 flex items-center gap-2">
        {icon}
        {title}
      </h2>

      <div className="space-y-3">
        {items.map(({ name, count }, i) => {
          const pct = total > 0 ? (count / total) * 100 : 0;

          return (
            <div key={name} className="flex items-center gap-3">
              <span className="text-sm font-bold text-stone-500 w-24 shrink-0">
                {name}
              </span>

              <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{
                    duration: 0.6,
                    delay: delay + 0.05 + i * 0.07,
                    ease: "easeOut",
                  }}
                  className={`h-full ${barColor} rounded-full`}
                />
              </div>

              <span className="text-sm font-bold text-stone-700 w-8 text-right shrink-0">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-stone-400 mt-4 italic">{note}</p>
    </motion.div>
  );
}

function RootStatLine({
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

function RootStatsSection({
  persons,
  relationships,
  families,
  familyParents,
  familyChildren,
}: {
  persons: Person[];
  relationships: Relationship[];
  families: FamilyRow[];
  familyParents: FamilyParentRow[];
  familyChildren: FamilyChildRow[];
}) {
  const sortedPersons = useMemo(() => {
    return [...persons].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b), "vi"),
    );
  }, [persons]);

  const [rootPersonId, setRootPersonId] = useState<string>(
    sortedPersons[0]?.id ?? "",
  );

  const rootStats: RootStatsResult | null = useMemo(() => {
    if (!rootPersonId) return null;

    return calculateRootStats({
      rootPersonId,
      persons,
      relationships,
      families,
      familyParents,
      familyChildren,
    });
  }, [
    rootPersonId,
    persons,
    relationships,
    families,
    familyParents,
    familyChildren,
  ]);

  const rootPerson = persons.find((person) => person.id === rootPersonId);

  if (persons.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.72 }}
      className="bg-gradient-to-br from-emerald-50 via-white to-sky-50 border border-emerald-100 rounded-2xl p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
            <GitBranch className="size-4 text-emerald-600" />
            Thống kê theo gốc gia phả
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            Dâu/rễ, họ nội, họ ngoại được tính lại theo người gốc đang chọn.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-stone-600">Chọn người gốc</span>
          <select
            value={rootPersonId}
            onChange={(event) => setRootPersonId(event.target.value)}
            className="min-w-64 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm outline-none focus:border-emerald-400"
          >
            {sortedPersons.map((person) => (
              <option key={person.id} value={person.id}>
                {getDisplayName(person)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rootStats ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-white/80 bg-white/80 p-4 text-sm text-stone-600">
            Đang tính theo gốc:{" "}
            <span className="font-bold text-stone-900">
              {rootPerson ? getDisplayName(rootPerson) : "Chưa chọn"}
            </span>
            <span className="ml-2 text-xs text-stone-400">
              ({rootStats.totalVisiblePeople} người liên quan)
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Huyết thống"
              value={rootStats.relation.bloodline}
              total={rootStats.totalVisiblePeople}
              icon={<Users className="size-5 text-emerald-600" />}
              color="bg-emerald-400"
              delay={0.76}
            />
            <StatCard
              label="Dâu/rễ theo gốc"
              value={rootStats.relation.inLaws}
              total={rootStats.totalVisiblePeople}
              icon={<Flower2 className="size-5 text-rose-500" />}
              color="bg-rose-400"
              delay={0.82}
            />
            <StatCard
              label="Họ nội / nhánh cha"
              value={rootStats.relation.paternalBranch}
              total={rootStats.totalVisiblePeople}
              icon={<Mars className="size-5 text-blue-600" />}
              color="bg-blue-400"
              delay={0.88}
            />
            <StatCard
              label="Họ ngoại / nhánh mẹ"
              value={rootStats.relation.maternalBranch}
              total={rootStats.totalVisiblePeople}
              icon={<Venus className="size-5 text-pink-500" />}
              color="bg-pink-400"
              delay={0.94}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-stone-700 mb-3">
                Phân loại quan hệ
              </h3>
              <RootStatLine
                label="Huyết thống"
                value={rootStats.relation.bloodline}
              />
              <RootStatLine
                label="Dâu/rễ theo gốc"
                value={rootStats.relation.inLaws}
              />
              <RootStatLine
                label="Họ nội / nhánh cha"
                value={rootStats.relation.paternalBranch}
              />
              <RootStatLine
                label="Họ ngoại / nhánh mẹ"
                value={rootStats.relation.maternalBranch}
              />
              <RootStatLine
                label="Cả hai nhánh"
                value={rootStats.relation.bothBranches}
              />
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-stone-700 mb-3">
                Giới tính trong nhánh
              </h3>
              <RootStatLine label="Nam" value={rootStats.gender.male} />
              <RootStatLine label="Nữ" value={rootStats.gender.female} />
              <RootStatLine label="Khác" value={rootStats.gender.other} />
              <RootStatLine label="Chưa rõ" value={rootStats.gender.unknown} />
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-stone-700 mb-3">
                Hôn nhân trong nhánh
              </h3>
              <RootStatLine
                label="Có gia đình"
                value={rootStats.maritalStatus.married}
              />
              <RootStatLine
                label="Chưa có gia đình"
                value={rootStats.maritalStatus.unmarried}
              />
              <RootStatLine
                label="Chưa rõ"
                value={rootStats.maritalStatus.unknown}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/80 bg-white/80 p-4 text-sm text-stone-500">
          Hãy chọn một người gốc để xem thống kê.
        </div>
      )}
    </motion.section>
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
  const globalStats = useMemo(() => {
    return calculateGlobalStats({
      persons,
      relationships,
      families,
      familyParents,
      familyChildren,
      events,
    });
  }, [persons, relationships, families, familyParents, familyChildren, events]);

  const legacyVisualStats = useMemo(() => {
    const total = persons.length;

    const firstBorn = persons.filter((p) => p.birth_order === 1).length;

    const genMap = new Map<number, number>();
    const zodiacMap = new Map<string, number>();
    const chineseZodiacMap = new Map<string, number>();

    persons.forEach((person) => {
      if (person.generation != null) {
        genMap.set(person.generation, (genMap.get(person.generation) ?? 0) + 1);
      }

      const zodiac = getZodiacSign(person.birth_day, person.birth_month);
      if (zodiac) {
        zodiacMap.set(zodiac, (zodiacMap.get(zodiac) ?? 0) + 1);
      }

      const chineseZodiac = getZodiacAnimal(
        person.birth_year,
        person.birth_month,
        person.birth_day,
      );
      if (chineseZodiac) {
        chineseZodiacMap.set(
          chineseZodiac,
          (chineseZodiacMap.get(chineseZodiac) ?? 0) + 1,
        );
      }
    });

    const generationBreakdown = Array.from(genMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([gen, count]) => ({ gen, count }));

    const zodiacBreakdown = Array.from(zodiacMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    const chineseZodiacBreakdown = Array.from(chineseZodiacMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    return {
      total,
      firstBorn,
      generationBreakdown,
      zodiacBreakdown,
      chineseZodiacBreakdown,
    };
  }, [persons]);

  const total = globalStats.totalPersons;

  const cards = [
    {
      label: "Tổng thành viên",
      value: globalStats.totalPersons,
      icon: <Users className="size-5 text-stone-600" />,
      color: "bg-stone-400",
    },
    {
      label: "Nam",
      value: globalStats.gender.male,
      icon: <Mars className="size-5 text-blue-600" />,
      color: "bg-blue-400",
    },
    {
      label: "Nữ",
      value: globalStats.gender.female,
      icon: <Venus className="size-5 text-pink-500" />,
      color: "bg-pink-400",
    },
    {
      label: "Có gia đình",
      value: globalStats.maritalStatus.married,
      icon: <Heart className="size-5 text-red-500" />,
      color: "bg-red-400",
    },
    {
      label: "Chưa có gia đình",
      value: globalStats.maritalStatus.unmarried,
      icon: <HeartOff className="size-5 text-stone-400" />,
      color: "bg-stone-300",
    },
    {
      label: "Có con",
      value: globalStats.childStatus.hasChildren,
      icon: <Baby className="size-5 text-emerald-600" />,
      color: "bg-emerald-400",
    },
    {
      label: "Đã mất",
      value: globalStats.lifeStatus.deceased,
      icon: <Skull className="size-5 text-stone-500" />,
      color: "bg-stone-400",
    },
    {
      label: "Gia đình",
      value: globalStats.totals.families,
      icon: <GitBranch className="size-5 text-indigo-500" />,
      color: "bg-indigo-400",
    },
    {
      label: "Sự kiện",
      value: globalStats.totals.events,
      icon: <Sparkles className="size-5 text-purple-500" />,
      color: "bg-purple-400",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            total={total}
            icon={card.icon}
            color={card.color}
            delay={i * 0.06}
          />
        ))}
      </div>

      {legacyVisualStats.generationBreakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="bg-white/80 border border-stone-200/60 rounded-2xl p-6 shadow-sm"
        >
          <h2 className="text-base font-bold text-stone-700 mb-5 flex items-center gap-2">
            <Crown className="size-4 text-amber-500" />
            Phân bố theo thế hệ
          </h2>
          <div className="space-y-3">
            {legacyVisualStats.generationBreakdown.map(({ gen, count }, i) => (
              <GenerationRow
                key={gen}
                gen={gen}
                count={count}
                max={legacyVisualStats.total}
                delay={0.85 + i * 0.07}
              />
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-4 italic">
            * Chỉ tính các thành viên đã được gán số thế hệ
          </p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.9 }}
        className="bg-white/80 border border-stone-200/60 rounded-2xl p-6 shadow-sm"
      >
        <h2 className="text-base font-bold text-stone-700 mb-5 flex items-center gap-2">
          <Users className="size-4 text-stone-500" />
          Tỉ lệ giới tính
        </h2>

        <div className="flex h-5 rounded-full overflow-hidden gap-px">
          {total > 0 && (
            <>
              <motion.div
                initial={{ flex: 0 }}
                animate={{ flex: globalStats.gender.male }}
                transition={{ duration: 0.7, delay: 0.95 }}
                className="bg-blue-400 flex items-center justify-center"
                title={`Nam: ${globalStats.gender.male}`}
              />
              <motion.div
                initial={{ flex: 0 }}
                animate={{ flex: globalStats.gender.female }}
                transition={{ duration: 0.7, delay: 0.95 }}
                className="bg-pink-400 flex items-center justify-center"
                title={`Nữ: ${globalStats.gender.female}`}
              />
              {globalStats.gender.other + globalStats.gender.unknown > 0 && (
                <motion.div
                  initial={{ flex: 0 }}
                  animate={{
                    flex: globalStats.gender.other + globalStats.gender.unknown,
                  }}
                  transition={{ duration: 0.7, delay: 0.95 }}
                  className="bg-stone-300 flex items-center justify-center"
                  title={`Khác/chưa rõ: ${
                    globalStats.gender.other + globalStats.gender.unknown
                  }`}
                />
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-6 mt-3 text-sm">
          <span className="flex items-center gap-2 text-stone-600">
            <span className="size-3 rounded-full bg-blue-400 inline-block" />
            Nam — {globalStats.gender.male} người (
            {total > 0 ? Math.round((globalStats.gender.male / total) * 100) : 0}
            %)
          </span>
          <span className="flex items-center gap-2 text-stone-600">
            <span className="size-3 rounded-full bg-pink-400 inline-block" />
            Nữ — {globalStats.gender.female} người (
            {total > 0
              ? Math.round((globalStats.gender.female / total) * 100)
              : 0}
            %)
          </span>
          <span className="flex items-center gap-2 text-stone-600">
            <span className="size-3 rounded-full bg-stone-300 inline-block" />
            Khác/chưa rõ —{" "}
            {globalStats.gender.other + globalStats.gender.unknown} người
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <BreakdownPanel
          title="Cung hoàng đạo"
          icon={<Star className="size-4 text-purple-500" />}
          items={legacyVisualStats.zodiacBreakdown}
          total={legacyVisualStats.total}
          barColor="bg-purple-400"
          delay={1}
          note="* Dự toán dựa trên ngày/tháng sinh dương lịch"
        />

        <BreakdownPanel
          title="Con giáp"
          icon={<Moon className="size-4 text-orange-500" />}
          items={legacyVisualStats.chineseZodiacBreakdown}
          total={legacyVisualStats.total}
          barColor="bg-orange-400"
          delay={1.1}
          note="* Dự toán dựa trên năm sinh âm lịch nếu có đủ ngày/tháng, nếu không dùng năm sinh"
        />
      </div>

      <RootStatsSection
        persons={persons}
        relationships={relationships}
        families={families}
        familyParents={familyParents}
        familyChildren={familyChildren}
      />

    </div>
  );
}