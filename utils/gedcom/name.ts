export type GedcomNameFormat = "standard" | "familygem";

export function splitVietnameseName(
  fullName: string,
  surname?: string | null,
  givenName?: string | null,
) {
  if (surname?.trim()) {
    return { surname: surname.trim(), givenName: (givenName ?? "").trim() };
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { surname: "Unknown", givenName: "Unknown" };
  if (parts.length === 1) return { surname: "", givenName: parts[0] };

  return {
    surname: parts[0],
    givenName: parts.slice(1).join(" "),
  };
}

export function formatGedcomNameStandard(
  fullName: string,
  surname?: string | null,
  givenName?: string | null,
) {
  const n = splitVietnameseName(fullName, surname, givenName);
  return n.surname ? `${n.givenName} /${n.surname}/` : `${n.givenName} //`;
}

export function formatGedcomNameFamilyGem(fullName: string) {
  const clean = fullName.trim().replace(/\s+/g, " ");
  return clean || "Unknown";
}

export function formatGedcomName(
  fullName: string,
  surname?: string | null,
  givenName?: string | null,
  format: GedcomNameFormat = "standard",
) {
  if (format === "familygem") {
    return formatGedcomNameFamilyGem(fullName);
  }

  return formatGedcomNameStandard(fullName, surname, givenName);
}

export function parseGedcomName(nameVal: string) {
  const value = nameVal.replace(/@@/g, "@").trim();

  const m = value.match(/^(.*?)\s*\/([^\/]*)\/\s*(.*)$/);
  if (m) {
    const given = `${m[1]} ${m[3]}`.trim();
    const surname = m[2].trim();
    const fullName = surname && given ? `${surname} ${given}` : surname || given;
    return { fullName, surname, givenName: given };
  }

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      fullName: value,
      surname: parts[0],
      givenName: parts.slice(1).join(" "),
    };
  }

  return { fullName: value };
}
