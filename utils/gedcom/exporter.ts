import type {
  GedcomEvent,
  GedcomExportResult,
  GedcomFamily,
  GedcomFamilyChild,
  GedcomFamilyParent,
  GedcomPerson,
  GedcomPersonEvent,
  GedcomPersonName,
  GedcomRelationship,
} from "./types";
import { GedcomWriter } from "./writer";
import { formatGedcomName, splitVietnameseName } from "./name";
import { formatGedcomDate } from "./date";

type ExportData = {
  persons: GedcomPerson[];
  relationships: GedcomRelationship[];

  person_names?: GedcomPersonName[];
  families?: GedcomFamily[];
  family_parents?: GedcomFamilyParent[];
  family_children?: GedcomFamilyChild[];
  events?: GedcomEvent[];
  person_events?: GedcomPersonEvent[];
};

type ExportFamily = {
  id: string;
  husb?: string;
  wife?: string;
  parents: string[];
  children: string[];
  status?: string | null;
  marriageEvent?: GedcomEvent | null;
  divorceEvent?: GedcomEvent | null;
};

type PersonEventBundle = {
  birthEvents: GedcomEvent[];
  deathEvents: GedcomEvent[];
};

export function exportToGedcom(data: ExportData): string {
  return exportToGedcomWithWarnings(data).content;
}

export function exportToGedcomWithWarnings(data: ExportData): GedcomExportResult {
  const warnings: string[] = [];
  const w = new GedcomWriter();

  const persons = data.persons ?? [];
  const relationships = data.relationships ?? [];
  const personNames = data.person_names ?? [];
  const events = (data.events ?? []).filter((event) => !event.deleted_at);
  const personEvents = data.person_events ?? [];

  w.addRaw("0 HEAD");
  w.addRaw("1 GEDC");
  w.addRaw("2 VERS 5.5.1");
  w.addRaw("1 CHAR UTF-8");
  w.addRaw("1 LANG Vietnamese");
  w.addRaw("1 SOUR GIAPHA_OS");
  w.addRaw("2 NAME Giapha OS");
  w.addRaw("2 VERS 2.3.4");

  const xref = new Map<string, string>();
  persons.forEach((person, i) => {
    if (person.id) xref.set(person.id, `I${i + 1}`);
  });

  const getIndi = (id?: string) => {
    return id && xref.has(id) ? `@${xref.get(id)}@` : "";
  };

  const families = buildExportFamilies(data, warnings);

  const personFamc = new Map<string, string[]>();
  const personFams = new Map<string, string[]>();

  for (const fam of families) {
    for (const parentId of fam.parents) {
      personFams.set(parentId, [...(personFams.get(parentId) ?? []), fam.id]);
    }

    for (const childId of fam.children) {
      personFamc.set(childId, [...(personFamc.get(childId) ?? []), fam.id]);
    }
  }

  const personEventMap = buildPersonEventMap({
    persons,
    events,
    personEvents,
  });

  for (const person of persons) {
    if (!person.id) continue;

    w.addRaw(`0 @${xref.get(person.id)}@ INDI`);

    const primaryName = getPrimaryPersonName(person.id, person, personNames);
    const fullName =
      primaryName.full_name?.trim() || person.full_name?.trim() || "Unknown";

    w.add(
      1,
      "NAME",
      formatGedcomName(fullName, primaryName.surname, primaryName.given_name),
    );

    const n = splitVietnameseName(
      fullName,
      primaryName.surname,
      primaryName.given_name,
    );

    if (n.surname) w.add(2, "SURN", n.surname);
    if (n.givenName) w.add(2, "GIVN", n.givenName);

    const alternateNames = getAlternatePersonNames(person.id, personNames);
    for (const alt of alternateNames) {
      const altFullName = alt.full_name?.trim();
      if (!altFullName || altFullName === fullName) continue;

      w.add(1, "NAME", formatGedcomName(altFullName, alt.surname, alt.given_name));
      w.add(2, "TYPE", alt.name_type || "also_known_as");
    }

    if (person.gender === "male") w.addRaw("1 SEX M");
    else if (person.gender === "female") w.addRaw("1 SEX F");
    else w.addRaw("1 SEX U");

    const bundle = personEventMap.get(person.id) ?? {
      birthEvents: [],
      deathEvents: [],
    };

    writeBirthEvent(w, person, bundle.birthEvents[0], warnings);
    writeDeathEvent(w, person, bundle.deathEvents[0], warnings);

    if (bundle.birthEvents.length > 1) {
      warnings.push(
        `Person ${person.id}: có nhiều birth events active, chỉ export event đầu tiên.`,
      );
    }

    if (bundle.deathEvents.length > 1) {
      warnings.push(
        `Person ${person.id}: có nhiều death events active, chỉ export event đầu tiên.`,
      );
    }

    for (const famId of personFamc.get(person.id) ?? []) {
      w.addRaw(`1 FAMC @${famId}@`);
    }

    for (const famId of personFams.get(person.id) ?? []) {
      w.addRaw(`1 FAMS @${famId}@`);
    }

    if (person.note) w.add(1, "NOTE", person.note);
  }

  for (const fam of families) {
    w.addRaw(`0 @${fam.id}@ FAM`);

    if (fam.husb) w.addRaw(`1 HUSB ${getIndi(fam.husb)}`);
    if (fam.wife) w.addRaw(`1 WIFE ${getIndi(fam.wife)}`);

    const extraParents = fam.parents.filter(
      (parentId) => parentId !== fam.husb && parentId !== fam.wife,
    );

    for (const parentId of extraParents) {
      w.addRaw(`1 ASSO ${getIndi(parentId)}`);
      w.add(2, "RELA", "parent");
      warnings.push(
        `Family ${fam.id}: có parent ngoài HUSB/WIFE GEDCOM chuẩn, export bằng ASSO.`,
      );
    }

    for (const childId of fam.children) {
      w.addRaw(`1 CHIL ${getIndi(childId)}`);
    }

    if (fam.marriageEvent) {
      w.addRaw("1 MARR");
      writeEventDatePlace(w, 2, fam.marriageEvent, warnings);
    } else if (
      fam.status &&
      fam.status !== "divorced" &&
      fam.status !== "separated"
    ) {
      w.addRaw("1 MARR");
    }

    if (
      fam.divorceEvent ||
      fam.status === "divorced" ||
      fam.status === "separated"
    ) {
      w.addRaw("1 DIV");
      if (fam.divorceEvent) {
        writeEventDatePlace(w, 2, fam.divorceEvent, warnings);
      }
    }

    if (fam.status) {
      w.add(1, "_GIAPHA_STATUS", fam.status);
    }
  }

  w.addRaw("0 TRLR");

  return {
    content: w.toString(),
    warnings,
  };
}

function getPrimaryPersonName(
  personId: string,
  person: GedcomPerson,
  names: GedcomPersonName[],
): Pick<GedcomPersonName, "full_name" | "surname" | "given_name"> {
  const personNames = names
    .filter((name) => name.person_id === personId)
    .sort((a, b) => {
      if (Boolean(a.is_primary) !== Boolean(b.is_primary)) {
        return a.is_primary ? -1 : 1;
      }

      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  const primary = personNames[0];

  return {
    full_name: primary?.full_name ?? person.full_name ?? null,
    surname: primary?.surname ?? person.surname ?? null,
    given_name: primary?.given_name ?? person.given_name ?? null,
  };
}

function getAlternatePersonNames(
  personId: string,
  names: GedcomPersonName[],
): GedcomPersonName[] {
  return names
    .filter((name) => name.person_id === personId && !name.is_primary)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function buildPersonEventMap(input: {
  persons: GedcomPerson[];
  events: GedcomEvent[];
  personEvents: GedcomPersonEvent[];
}): Map<string, PersonEventBundle> {
  const out = new Map<string, PersonEventBundle>();

  const personIds = new Set(
    input.persons.map((person) => person.id).filter(Boolean) as string[],
  );
  const eventsById = new Map(input.events.map((event) => [event.id, event]));

  for (const pe of input.personEvents) {
    if (!personIds.has(pe.person_id)) continue;

    const event = eventsById.get(pe.event_id);
    if (!event) continue;

    if (event.type !== "birth" && event.type !== "death") continue;

    const bundle = out.get(pe.person_id) ?? {
      birthEvents: [],
      deathEvents: [],
    };

    if (event.type === "birth") bundle.birthEvents.push(event);
    if (event.type === "death") bundle.deathEvents.push(event);

    out.set(pe.person_id, bundle);
  }

  for (const event of input.events) {
    if (!event.legacy_person_id) continue;
    if (!personIds.has(event.legacy_person_id)) continue;
    if (event.type !== "birth" && event.type !== "death") continue;

    const bundle = out.get(event.legacy_person_id) ?? {
      birthEvents: [],
      deathEvents: [],
    };

    const target = event.type === "birth" ? bundle.birthEvents : bundle.deathEvents;
    if (!target.some((existing) => existing.id === event.id)) {
      target.push(event);
    }

    out.set(event.legacy_person_id, bundle);
  }

  for (const bundle of out.values()) {
    bundle.birthEvents.sort(compareEvents);
    bundle.deathEvents.sort(compareEvents);
  }

  return out;
}

function compareEvents(a: GedcomEvent, b: GedcomEvent): number {
  const ad = a.sort_date ?? a.start_date ?? "";
  const bd = b.sort_date ?? b.start_date ?? "";
  return ad.localeCompare(bd);
}

function writeBirthEvent(
  w: GedcomWriter,
  person: GedcomPerson,
  event: GedcomEvent | undefined,
  warnings: string[],
) {
  if (event) {
    w.addRaw("1 BIRT");
    writeEventDatePlace(w, 2, event, warnings);
    return;
  }

  const birthDate = formatGedcomDate(
    person.birth_year,
    person.birth_month,
    person.birth_day,
  );

  if (birthDate) {
    w.addRaw("1 BIRT");
    w.add(2, "DATE", birthDate);
  }
}

function writeDeathEvent(
  w: GedcomWriter,
  person: GedcomPerson,
  event: GedcomEvent | undefined,
  warnings: string[],
) {
  if (event) {
    w.addRaw("1 DEAT");
    writeEventDatePlace(w, 2, event, warnings);
    writeLunarEvent(w, 2, event);
    return;
  }

  if (person.is_deceased) {
    w.addRaw("1 DEAT Y");

    const deathDate = formatGedcomDate(
      person.death_year,
      person.death_month,
      person.death_day,
    );

    if (deathDate) w.add(2, "DATE", deathDate);

    if (
      person.death_lunar_year ||
      person.death_lunar_month ||
      person.death_lunar_day
    ) {
      const lunar = [
        person.death_lunar_day
          ? String(person.death_lunar_day).padStart(2, "0")
          : "",
        person.death_lunar_month
          ? String(person.death_lunar_month).padStart(2, "0")
          : "",
        person.death_lunar_year ? String(person.death_lunar_year) : "",
      ].join("/");

      w.add(2, "_GIAPHA_LUNAR", lunar);
      if (person.death_lunar_is_leap) w.add(2, "_GIAPHA_LUNAR_LEAP", "Y");
    }
  }
}

function writeEventDatePlace(
  w: GedcomWriter,
  level: number,
  event: GedcomEvent,
  warnings: string[],
) {
  const gedcomDate = formatGedcomDateFromEvent(event, warnings);
  if (gedcomDate) w.add(level, "DATE", gedcomDate);

  if (event.place_text) w.add(level, "PLAC", event.place_text);
  if (event.description) w.add(level, "NOTE", event.description);
}

function writeLunarEvent(w: GedcomWriter, level: number, event: GedcomEvent) {
  if (!event.lunar_year && !event.lunar_month && !event.lunar_day) return;

  const lunar = [
    event.lunar_day ? String(event.lunar_day).padStart(2, "0") : "",
    event.lunar_month ? String(event.lunar_month).padStart(2, "0") : "",
    event.lunar_year ? String(event.lunar_year) : "",
  ].join("/");

  w.add(level, "_GIAPHA_LUNAR", lunar);
  if (event.lunar_is_leap_month) w.add(level, "_GIAPHA_LUNAR_LEAP", "Y");
}

function formatGedcomDateFromEvent(
  event: GedcomEvent,
  warnings: string[],
): string | null {
  if (event.date_original_text && event.canonical_calendar === "text") {
    warnings.push(
      `Event ${event.id}: date text/range không map chuẩn GEDCOM, export date_original_text.`,
    );
    return event.date_original_text;
  }

  if (!event.start_date) return null;

  const start = parseIsoDate(event.start_date);
  if (!start) return null;

  if (event.date_precision === "year") {
    return formatGedcomDate(start.year, null, null, event.date_modifier);
  }

  if (event.date_precision === "month") {
    return formatGedcomDate(start.year, start.month, null, event.date_modifier);
  }

  if (event.date_precision === "day" || !event.date_precision) {
    return formatGedcomDate(
      start.year,
      start.month,
      start.day,
      event.date_modifier,
    );
  }

  if (event.date_precision === "range" && event.end_date) {
    const end = parseIsoDate(event.end_date);
    if (!end) {
      return formatGedcomDate(
        start.year,
        start.month,
        start.day,
        event.date_modifier,
      );
    }

    return `FROM ${
      formatGedcomDate(start.year, start.month, start.day) ?? ""
    } TO ${formatGedcomDate(end.year, end.month, end.day) ?? ""}`;
  }

  warnings.push(
    `Event ${event.id}: date_precision=${event.date_precision} chưa map chuẩn GEDCOM, export best-effort.`,
  );

  return formatGedcomDate(start.year, start.month, start.day, event.date_modifier);
}

function parseIsoDate(input: string): { year: number; month: number; day: number } | null {
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function buildExportFamilies(data: ExportData, warnings: string[]): ExportFamily[] {
  const familyModelFamilies = buildFamiliesFromFamilyModel(data, warnings);

  if (familyModelFamilies.length > 0) {
    return familyModelFamilies;
  }

  return buildLegacyFamilies(data.persons, data.relationships, warnings);
}

function buildFamiliesFromFamilyModel(
  data: ExportData,
  warnings: string[],
): ExportFamily[] {
  const persons = data.persons ?? [];
  const families = (data.families ?? []).filter((family) => !family.deleted_at);
  const familyParents = data.family_parents ?? [];
  const familyChildren = data.family_children ?? [];
  const events = (data.events ?? []).filter((event) => !event.deleted_at);

  if (families.length === 0 || familyParents.length === 0) {
    return [];
  }

  const personMap = new Map(persons.filter((p) => p.id).map((p) => [p.id!, p]));
  const exportedFamilies: ExportFamily[] = [];

  for (const family of families) {
    const parentRows = familyParents
      .filter((parent) => parent.family_id === family.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const childRows = familyChildren
      .filter((child) => child.family_id === family.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const validParentIds = parentRows
      .map((parent) => parent.person_id)
      .filter((personId) => personMap.has(personId));

    const validChildIds = childRows
      .map((child) => child.person_id)
      .filter((personId) => personMap.has(personId));

    if (validParentIds.length === 0 && validChildIds.length > 0) {
      warnings.push(`Family ${family.id}: có child nhưng không có parent.`);
    }

    if (validParentIds.length === 0 && validChildIds.length === 0) {
      continue;
    }

    const husb = pickParentByRoleOrGender({
      parentRows,
      validParentIds,
      personMap,
      role: "husband",
      gender: "male",
    });

    const wife = pickParentByRoleOrGender({
      parentRows,
      validParentIds,
      personMap,
      role: "wife",
      gender: "female",
      exclude: husb ? new Set([husb]) : undefined,
    });

    const marriageEvent = events
      .filter((event) => event.family_id === family.id && event.type === "marriage")
      .sort(compareEvents)[0];

    const divorceEvent = events
      .filter((event) => event.family_id === family.id && event.type === "divorce")
      .sort(compareEvents)[0];

    exportedFamilies.push({
      id: makeGedcomFamilyId(family.id),
      husb,
      wife,
      parents: validParentIds,
      children: validChildIds,
      status: family.status,
      marriageEvent,
      divorceEvent,
    });
  }

  return exportedFamilies;
}

function pickParentByRoleOrGender(input: {
  parentRows: GedcomFamilyParent[];
  validParentIds: string[];
  personMap: Map<string, GedcomPerson>;
  role: string;
  gender: "male" | "female";
  exclude?: Set<string>;
}): string | undefined {
  const byRole = input.parentRows.find((row) => {
    if (!input.validParentIds.includes(row.person_id)) return false;
    if (input.exclude?.has(row.person_id)) return false;
    return row.role === input.role;
  });

  if (byRole) return byRole.person_id;

  const byGender = input.validParentIds.find((personId) => {
    if (input.exclude?.has(personId)) return false;
    return input.personMap.get(personId)?.gender === input.gender;
  });

  if (byGender) return byGender;

  return input.validParentIds.find((personId) => !input.exclude?.has(personId));
}

function makeGedcomFamilyId(familyId: string): string {
  const clean = familyId.replace(/[^A-Za-z0-9]/g, "").slice(0, 24);
  return `F${clean || familyId}`;
}

function buildLegacyFamilies(
  persons: GedcomPerson[],
  rels: GedcomRelationship[],
  warnings: string[],
): ExportFamily[] {
  const personMap = new Map(persons.filter((p) => p.id).map((p) => [p.id!, p]));
  const families: ExportFamily[] = [];
  let f = 1;

  for (const rel of rels.filter((r) => r.type === "marriage")) {
    if (!rel.person_a || !rel.person_b) continue;

    const a = personMap.get(rel.person_a);
    const b = personMap.get(rel.person_b);
    if (!a || !b) continue;

    const husb =
      a.gender === "male"
        ? rel.person_a
        : b.gender === "male"
          ? rel.person_b
          : rel.person_a;

    const wife =
      a.gender === "female"
        ? rel.person_a
        : b.gender === "female"
          ? rel.person_b
          : rel.person_b;

    families.push({
      id: `F${f++}`,
      husb,
      wife,
      parents: [husb, wife].filter(Boolean),
      children: [],
      status: rel.status,
    });
  }

  const parentMarriageCount = new Map<string, number>();
  for (const fam of families) {
    for (const parent of [fam.husb, fam.wife].filter(Boolean) as string[]) {
      parentMarriageCount.set(parent, (parentMarriageCount.get(parent) ?? 0) + 1);
    }
  }

  for (const rel of rels.filter(
    (r) => r.type === "biological_child" || r.type === "adopted_child",
  )) {
    if (!rel.person_a || !rel.person_b) continue;

    let fam = families.find((x) => x.husb === rel.person_a || x.wife === rel.person_a);

    if ((parentMarriageCount.get(rel.person_a) ?? 0) > 1) {
      warnings.push(
        `Child ${rel.person_b}: parent ${rel.person_a} có nhiều hôn nhân. ` +
          `Legacy relationships không đủ family unit, exporter chỉ gán best-effort. ` +
          `Hãy kiểm tra lại Family Model.`,
      );
    }

    if (!fam) {
      const p = personMap.get(rel.person_a);
      const parentId = rel.person_a;

      fam = {
        id: `F${f++}`,
        husb: p?.gender === "male" ? parentId : undefined,
        wife: p?.gender === "female" ? parentId : undefined,
        parents: [parentId],
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
