import Link from "next/link";
import type { Person } from "@/types";

function getYearsAndAgeLabel(person: Person): string | null {
  const birthYear = typeof person.birth_year === "number" ? person.birth_year : null;
  const deathYear = typeof person.death_year === "number" ? person.death_year : null;

  if (!birthYear && !deathYear) return null;

  const currentYear = new Date().getFullYear();
  const endYear = deathYear ?? currentYear;
  const age = birthYear ? Math.max(0, endYear - birthYear) : null;

  if (birthYear && deathYear) {
    return `${birthYear}–${deathYear}${age !== null ? ` (${age} tuổi)` : ""}`;
  }

  if (birthYear) {
    return `${birthYear}${age !== null ? ` (${age} tuổi)` : ""}`;
  }

  return `Mất ${deathYear}`;
}

function getCardClass(person: Person): string {
  if (person.is_deceased) {
    return "border-stone-200 bg-stone-50 text-stone-700";
  }

  if (person.gender === "male") return "border-sky-100 bg-sky-50/80 text-sky-950";
  if (person.gender === "female") return "border-rose-100 bg-rose-50/80 text-rose-950";
  return "border-stone-100 bg-white text-stone-800";
}

export default function LineagePersonCard({
  person,
  relationLabel,
  note,
  addressHint,
  compact = false,
}: {
  person: Person;
  relationLabel: string;
  note?: string;
  addressHint?: string;
  compact?: boolean;
}) {
  const yearsAndAge = getYearsAndAgeLabel(person);
  const kinshipLabel = addressHint || relationLabel;
  const secondaryLabel = addressHint && addressHint !== relationLabel ? relationLabel : null;

  return (
    <Link
      href={`/dashboard/members/${person.id}`}
      title={[person.full_name, yearsAndAge, kinshipLabel, secondaryLabel, note].filter(Boolean).join(" · ")}
      className={`block rounded-xl border px-2.5 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${getCardClass(person)}`}
    >
      <p className="truncate text-[13px] font-bold leading-tight">{person.full_name}</p>

      {yearsAndAge ? (
        <p className="mt-0.5 truncate text-[11px] leading-tight text-stone-500">
          {yearsAndAge}
        </p>
      ) : null}

      <p className="mt-1 rounded-lg bg-white/65 px-2 py-1 text-[11px] font-semibold leading-snug text-stone-700 ring-1 ring-white/70">
        {kinshipLabel}
      </p>

      {!compact && secondaryLabel ? (
        <p className="mt-1 text-[11px] leading-snug text-stone-500">{secondaryLabel}</p>
      ) : null}

      {!compact && note ? (
        <p className="mt-1 text-[11px] leading-snug text-stone-500">{note}</p>
      ) : null}
    </Link>
  );
}
