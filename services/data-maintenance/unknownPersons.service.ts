export type UnknownPersonLike = {
  id: string;
  full_name: string | null;
  gender?: string | null;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

export type UnknownPersonRow = {
  id: string;
  fullName: string;
  gender: string;
  birthText: string;
  createdAt: string | null;
  updatedAt: string | null;
  suggestedName: string;
};

export function isUnknownPersonName(name: string | null | undefined): boolean {
  const normalized = String(name ?? "").trim().toLowerCase();

  return (
    normalized === "unknown" ||
    normalized === "chưa rõ tên" ||
    normalized === "chua ro ten" ||
    normalized === ""
  );
}

export function buildUnknownPersonRows(
  persons: UnknownPersonLike[],
): UnknownPersonRow[] {
  return persons
    .filter((person) => !person.deleted_at)
    .filter((person) => isUnknownPersonName(person.full_name))
    .sort((a, b) => {
      return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    })
    .map((person, index) => ({
      id: person.id,
      fullName: person.full_name?.trim() || "Chưa rõ tên",
      gender: person.gender || "unknown",
      birthText: formatBirthText(person),
      createdAt: person.created_at ?? null,
      updatedAt: person.updated_at ?? null,
      suggestedName: `Chưa rõ tên ${index + 1}`,
    }));
}

function formatBirthText(person: UnknownPersonLike): string {
  if (!person.birth_year) return "—";

  const year = String(person.birth_year);
  const month = person.birth_month
    ? String(person.birth_month).padStart(2, "0")
    : "";
  const day = person.birth_day
    ? String(person.birth_day).padStart(2, "0")
    : "";

  if (day && month) return `${day}-${month}-${year}`;
  if (month) return `${month}-${year}`;
  return year;
}
