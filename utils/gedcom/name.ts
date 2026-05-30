export function splitVietnameseName(
  fullName: string,
  surname?: string | null,
  givenName?: string | null,
) {
  if (surname?.trim()) {
    return { surname: surname.trim(), givenName: (givenName ?? '').trim() };
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { surname: 'Unknown', givenName: 'Unknown' };
  if (parts.length === 1) return { surname: '', givenName: parts[0] };
  return { surname: parts[0], givenName: parts.slice(1).join(' ') };
}

export function formatGedcomName(fullName: string, surname?: string | null, givenName?: string | null) {
  const n = splitVietnameseName(fullName, surname, givenName);
  return n.surname ? `${n.givenName} /${n.surname}/` : `${n.givenName} //`;
}

export function parseGedcomName(nameVal: string) {
  const value = nameVal.replace(/@@/g, '@').trim();
  const m = value.match(/^(.*?)\s*\/([^\/]*)\/\s*(.*)$/);
  if (!m) return { fullName: value };

  const given = `${m[1]} ${m[3]}`.trim();
  const surname = m[2].trim();
  const fullName = surname && given ? `${surname} ${given}` : surname || given;
  return { fullName, surname, givenName: given };
}
