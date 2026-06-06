import Link from "next/link";
import type { Person } from "@/types";

function getPersonLabel(person: Person): string {
  const years = [person.birth_year, person.death_year]
    .filter((value): value is number => typeof value === "number")
    .join("–");

  if (years) return `${person.full_name} (${years})`;
  return person.full_name;
}

function getGenderPill(person: Person): string {
  if (person.gender === "male") return "Nam";
  if (person.gender === "female") return "Nữ";
  return "Khác";
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
  return (
    <Link
      href={`/dashboard/members/${person.id}`}
      className={`block rounded-xl border px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${getCardClass(person)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">{getPersonLabel(person)}</p>
          <p className="mt-0.5 text-xs font-medium text-stone-500">{relationLabel}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-semibold text-stone-500 ring-1 ring-stone-200">
          {getGenderPill(person)}
        </span>
      </div>

      {!compact && addressHint ? (
        <p className="mt-1 rounded-lg bg-white/65 px-2 py-1 text-xs leading-snug text-stone-600 ring-1 ring-white/70">
          {addressHint}
        </p>
      ) : null}

      {!compact && note ? (
        <p className="mt-1 text-xs leading-snug text-stone-500">{note}</p>
      ) : null}
    </Link>
  );
}
