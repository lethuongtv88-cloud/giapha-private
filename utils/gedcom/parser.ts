import { parseGedcomName } from './name';

function isGedcomUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeGedcomPointerId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .replace(/@+$/, "");
}

function getStableGedcomPersonId(xref: unknown, fallbackFactory: () => string) {
  const normalized = normalizeGedcomPointerId(xref);
  return isGedcomUuidLike(normalized) ? normalized : fallbackFactory();
}

export function parseGedcom(content: string) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const persons: any[] = [];
  const relationships: any[] = [];
  const fams: any[] = [];

  let current: any = null;
  let currentType: 'INDI' | 'FAM' | null = null;
  let currentEvent: 'BIRT' | 'DEAT' | null = null;

  for (const raw of lines) {
    const m = raw.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/);
    if (!m) continue;

    const level = Number(m[1]);
    const xref = m[2];
    const tag = m[3];
    const val = m[4] ?? '';

    if (level === 0) {
      currentEvent = null;

      if (tag === 'INDI' && xref) {
        current = { xref, full_name: 'Unknown', gender: 'other' };
        persons.push(current);
        currentType = 'INDI';
      } else if (tag === 'FAM' && xref) {
        current = { xref, husb: null, wife: null, children: [] };
        fams.push(current);
        currentType = 'FAM';
      } else {
        current = null;
        currentType = null;
      }

      continue;
    }

    if (!current) continue;

    if (currentType === 'INDI') {
      if (tag === 'NAME') Object.assign(current, parseGedcomName(val));
      if (tag === 'SURN') current.surname = val.trim();
      if (tag === 'GIVN') current.given_name = val.trim();
      if (tag === 'SEX') current.gender = val === 'M' ? 'male' : val === 'F' ? 'female' : 'other';
      if (tag === 'BIRT') currentEvent = 'BIRT';
      if (tag === 'DEAT') { currentEvent = 'DEAT'; current.is_deceased = true; }
      if (tag === 'DATE' && currentEvent) parseDateIntoPerson(current, currentEvent, val);
      if ((tag === '_GIAPHA_LUNAR' || tag === '_LUNAR') && currentEvent) parseLunarIntoPerson(current, currentEvent, val);
    }

    if (currentType === 'FAM') {
      if (tag === 'HUSB') current.husb = val.trim();
      if (tag === 'WIFE') current.wife = val.trim();
      if (tag === 'CHIL') current.children.push(val.trim());
    }
  }

  for (const p of persons) {
    p.id = getStableGedcomPersonId(p.xref, makeId);
  }

  const xrefToId = new Map(persons.map(p => [p.xref, p.id]));

  for (const fam of fams) {
    const husbId = fam.husb ? xrefToId.get(fam.husb) : null;
    const wifeId = fam.wife ? xrefToId.get(fam.wife) : null;

    if (husbId && wifeId) {
      relationships.push({ type: 'marriage', person_a: husbId, person_b: wifeId });
    }

    for (const childX of fam.children) {
      const childId = xrefToId.get(childX);
      if (!childId) continue;

      if (husbId) relationships.push({ type: 'biological_child', person_a: husbId, person_b: childId });
      if (wifeId) relationships.push({ type: 'biological_child', person_a: wifeId, person_b: childId });
    }
  }

  return { persons, relationships };
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return generateUUID();
}

function parseDateIntoPerson(p: any, ev: 'BIRT' | 'DEAT', date: string) {
  const parts = date.trim().split(/\s+/);
  const year = Number(parts[parts.length - 1]);
  if (!Number.isFinite(year)) return;

  const prefix = ev === 'BIRT' ? 'birth' : 'death';
  p[`${prefix}_year`] = year;

  if (parts.length >= 2) p[`${prefix}_month`] = parseMonth(parts[parts.length - 2]);
  if (parts.length >= 3) p[`${prefix}_day`] = Number(parts[parts.length - 3]) || null;
}

function parseLunarIntoPerson(p: any, ev: 'BIRT' | 'DEAT', value: string) {
  const [d, m, y] = value.split('/').map(Number);
  const prefix = ev === 'BIRT' ? 'birth' : 'death';

  p[`${prefix}_lunar_day`] = d || null;
  p[`${prefix}_lunar_month`] = m || null;
  p[`${prefix}_lunar_year`] = y || null;
}

function parseMonth(m: string) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const i = months.indexOf(m.toUpperCase());
  return i >= 0 ? i + 1 : null;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
