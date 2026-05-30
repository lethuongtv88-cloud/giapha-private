import type { GedcomPerson, GedcomRelationship, GedcomExportResult } from './types';
import { GedcomWriter } from './writer';
import { formatGedcomName, splitVietnameseName } from './name';
import { formatGedcomDate } from './date';

type ExportData = {
  persons: GedcomPerson[];
  relationships: GedcomRelationship[];
};

type LegacyFamily = {
  id: string;
  husb?: string;
  wife?: string;
  children: string[];
};

export function exportToGedcom(data: ExportData): string {
  return exportToGedcomWithWarnings(data).content;
}

export function exportToGedcomWithWarnings(data: ExportData): GedcomExportResult {
  const warnings: string[] = [];
  const w = new GedcomWriter();

  w.addRaw('0 HEAD');
  w.addRaw('1 GEDC');
  w.addRaw('2 VERS 5.5.1');
  w.addRaw('1 CHAR UTF-8');
  w.addRaw('1 LANG Vietnamese');
  w.addRaw('1 SOUR GIAPHA_OS');
  w.addRaw('2 NAME Giapha OS');
  w.addRaw('2 VERS 2.3.3');

  const xref = new Map<string, string>();
  data.persons.forEach((p, i) => { if (p.id) xref.set(p.id, `I${i + 1}`); });
  const getIndi = (id?: string) => id && xref.has(id) ? `@${xref.get(id)}@` : '';

  const families = buildLegacyFamilies(data.persons, data.relationships, warnings);

  const personFamc = new Map<string, string[]>();
  const personFams = new Map<string, string[]>();

  for (const fam of families) {
    if (fam.husb) personFams.set(fam.husb, [...(personFams.get(fam.husb) ?? []), fam.id]);
    if (fam.wife) personFams.set(fam.wife, [...(personFams.get(fam.wife) ?? []), fam.id]);
    for (const child of fam.children) {
      personFamc.set(child, [...(personFamc.get(child) ?? []), fam.id]);
    }
  }

  for (const person of data.persons) {
    if (!person.id) continue;

    w.addRaw(`0 @${xref.get(person.id)}@ INDI`);

    const fullName = person.full_name?.trim() || 'Unknown';
    w.add(1, 'NAME', formatGedcomName(fullName, person.surname, person.given_name));

    const n = splitVietnameseName(fullName, person.surname, person.given_name);
    if (n.surname) w.add(2, 'SURN', n.surname);
    if (n.givenName) w.add(2, 'GIVN', n.givenName);

    if (person.gender === 'male') w.addRaw('1 SEX M');
    else if (person.gender === 'female') w.addRaw('1 SEX F');
    else w.addRaw('1 SEX U');

    const birthDate = formatGedcomDate(person.birth_year, person.birth_month, person.birth_day);
    if (birthDate) {
      w.addRaw('1 BIRT');
      w.add(2, 'DATE', birthDate);
    }

    if (person.is_deceased) {
      w.addRaw('1 DEAT Y');
      const deathDate = formatGedcomDate(person.death_year, person.death_month, person.death_day);
      if (deathDate) w.add(2, 'DATE', deathDate);

      if (person.death_lunar_year || person.death_lunar_month || person.death_lunar_day) {
        const lunar = [
          person.death_lunar_day ? String(person.death_lunar_day).padStart(2, '0') : '',
          person.death_lunar_month ? String(person.death_lunar_month).padStart(2, '0') : '',
          person.death_lunar_year ? String(person.death_lunar_year) : '',
        ].join('/');

        w.add(2, '_GIAPHA_LUNAR', lunar);
        if (person.death_lunar_is_leap) w.add(2, '_GIAPHA_LUNAR_LEAP', 'Y');
      }
    }

    for (const famId of personFamc.get(person.id) ?? []) w.addRaw(`1 FAMC @${famId}@`);
    for (const famId of personFams.get(person.id) ?? []) w.addRaw(`1 FAMS @${famId}@`);

    if (person.note) w.add(1, 'NOTE', person.note);
  }

  for (const fam of families) {
    w.addRaw(`0 @${fam.id}@ FAM`);
    if (fam.husb) w.addRaw(`1 HUSB ${getIndi(fam.husb)}`);
    if (fam.wife) w.addRaw(`1 WIFE ${getIndi(fam.wife)}`);
    for (const child of fam.children) w.addRaw(`1 CHIL ${getIndi(child)}`);
  }

  w.addRaw('0 TRLR');

  return {
    content: w.toString(),
    warnings,
  };
}

function buildLegacyFamilies(
  persons: GedcomPerson[],
  rels: GedcomRelationship[],
  warnings: string[],
): LegacyFamily[] {
  const personMap = new Map(persons.filter(p => p.id).map(p => [p.id!, p]));
  const families: LegacyFamily[] = [];
  let f = 1;

  for (const rel of rels.filter(r => r.type === 'marriage')) {
    if (!rel.person_a || !rel.person_b) continue;

    const a = personMap.get(rel.person_a);
    const b = personMap.get(rel.person_b);
    if (!a || !b) continue;

    const husb = a.gender === 'male'
      ? rel.person_a
      : b.gender === 'male'
        ? rel.person_b
        : rel.person_a;

    const wife = a.gender === 'female'
      ? rel.person_a
      : b.gender === 'female'
        ? rel.person_b
        : rel.person_b;

    families.push({ id: `F${f++}`, husb, wife, children: [] });
  }

  const parentMarriageCount = new Map<string, number>();
  for (const fam of families) {
    for (const parent of [fam.husb, fam.wife].filter(Boolean) as string[]) {
      parentMarriageCount.set(parent, (parentMarriageCount.get(parent) ?? 0) + 1);
    }
  }

  for (const rel of rels.filter(r => r.type === 'biological_child' || r.type === 'adopted_child')) {
    if (!rel.person_a || !rel.person_b) continue;

    let fam = families.find(x => x.husb === rel.person_a || x.wife === rel.person_a);

    if ((parentMarriageCount.get(rel.person_a) ?? 0) > 1) {
      warnings.push(
        `Child ${rel.person_b}: parent ${rel.person_a} có nhiều hôn nhân. ` +
        `Legacy relationships không đủ family unit, exporter chỉ gán best-effort. ` +
        `Hãy kiểm tra lại sau khi nâng cấp Family Model.`
      );
    }

    if (!fam) {
      const p = personMap.get(rel.person_a);
      fam = {
        id: `F${f++}`,
        husb: p?.gender === 'male' ? rel.person_a : undefined,
        wife: p?.gender === 'female' ? rel.person_a : undefined,
        children: [],
      };
      families.push(fam);
    }

    if (!fam.children.includes(rel.person_b)) {
      fam.children.push(rel.person_b);
    }
  }

  return families;
}
