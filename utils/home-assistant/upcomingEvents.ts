import { buildEventMessage } from "@/utils/events/eventMessages";
import { getVietnamToday } from "@/utils/dateHelpers";
import { Lunar, Solar } from "lunar-javascript";
import {
  buildVisiblePersonSetForProfile,
  filterPersonEventsForVisiblePersons,
} from "@/utils/permissions/applyPersonVisibility";

export type HaProfile = {
  id?: string | null;
  role?: string | null;
  person_id?: string | null;
  email?: string | null;
  full_name?: string | null;
};

export type HaPerson = {
  id: string;
  full_name: string;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  death_lunar_year?: number | null;
  death_lunar_month?: number | null;
  death_lunar_day?: number | null;
  is_deceased?: boolean | null;
  deleted_at?: string | null;
};

export type HaEvent = {
  id: string;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  place_text?: string | null;
  start_date?: string | null;
  sort_date?: string | null;
  date_precision?: string | null;
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_is_leap_month?: boolean | null;
  family_id?: string | null;
  legacy_person_id?: string | null;
  deleted_at?: string | null;
};

export type HaPersonEvent = {
  person_id: string;
  event_id: string;
  role?: string | null;
};

export type HaRelationship = {
  id?: string;
  type?: string | null;
  person_a?: string | null;
  person_b?: string | null;
  deleted_at?: string | null;
};

export type HaFamily = {
  id: string;
  deleted_at?: string | null;
};

export type HaFamilyParent = {
  family_id: string;
  person_id: string;
  role?: string | null;
};

export type HaFamilyChild = {
  family_id: string;
  person_id: string;
  relationship_type?: string | null;
};

export type HaCustomEvent = {
  id: string;
  name: string;
  content: string | null;
  event_date: string;
  location: string | null;
};

export type HomeAssistantUpcomingEvent = {
  id: string;
  source: "person_legacy" | "event_model" | "custom_events";
  type: string;
  title: string;
  message: string;
  emoji: string;
  label: string;
  date: string;
  daysUntil: number;
  personId: string | null;
  personName: string | null;
  location: string | null;
  lunarDate: string | null;
  eventId: string | null;
};

function startOfLocalDay(date: Date) {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

function parseIsoLocalDate(value?: string | null) {
  const raw = value?.slice(0, 10);
  const match = raw?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return null;
  return startOfLocalDay(date);
}

function isoDate(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function differenceInDays(from: Date, to: Date) {
  const ms = startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

function nextYearlyOccurrence(month: number, day: number) {
  const today = startOfLocalDay(getVietnamToday());
  let occurrence = new Date(today.getFullYear(), month - 1, day);
  occurrence = startOfLocalDay(occurrence);
  if (occurrence.getTime() < today.getTime()) {
    occurrence = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return startOfLocalDay(occurrence);
}

function nextSolarForLunar(
  lunarMonth: number,
  lunarDay: number,
  fromDate: Date,
  isLeapMonth = false,
) {
  try {
    const todaySolar = Solar.fromYmd(
      fromDate.getFullYear(),
      fromDate.getMonth() + 1,
      fromDate.getDate(),
    );
    const currentLunarYear = todaySolar.getLunar().getYear();
    const lunarMonthValue = isLeapMonth ? -lunarMonth : lunarMonth;

    for (let offset = 0; offset <= 2; offset += 1) {
      try {
        const lunar = Lunar.fromYmd(currentLunarYear + offset, lunarMonthValue, lunarDay);
        const solar = lunar.getSolar();
        const candidate = startOfLocalDay(
          new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay()),
        );
        if (candidate.getTime() >= startOfLocalDay(fromDate).getTime()) return candidate;
      } catch {
        // Leap lunar months do not exist every year; try the next lunar year.
      }
    }
  } catch {
    return null;
  }

  return null;
}

function nextMemorialOccurrence(event: HaEvent, eventDate: Date, today: Date) {
  if (event.lunar_month && event.lunar_day) {
    return nextSolarForLunar(
      event.lunar_month,
      event.lunar_day,
      today,
      Boolean(event.lunar_is_leap_month),
    );
  }

  return nextYearlyOccurrence(eventDate.getMonth() + 1, eventDate.getDate());
}

function formatLunar(input: {
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_is_leap_month?: boolean | null;
}) {
  if (!input.lunar_year && !input.lunar_month && !input.lunar_day) return null;
  const day = input.lunar_day ? String(input.lunar_day).padStart(2, "0") : "??";
  const month = input.lunar_month ? String(input.lunar_month).padStart(2, "0") : "??";
  const year = input.lunar_year ? String(input.lunar_year) : "????";
  return `${day}/${month}/${year}${input.lunar_is_leap_month ? " nhuận" : ""}`;
}

function getPrincipalIds(eventId: string, links: HaPersonEvent[]) {
  return links
    .filter((row) => row.event_id === eventId)
    .filter((row) => row.role !== "visibility_root")
    .map((row) => row.person_id);
}

function getRootId(eventId: string, links: HaPersonEvent[]) {
  return links.find((row) => row.event_id === eventId && row.role === "visibility_root")?.person_id ?? null;
}

function isDirectMarriageViewer(input: {
  event: HaEvent;
  personEvents: HaPersonEvent[];
  familyChildren: HaFamilyChild[];
  viewerPersonId: string | null;
}) {
  if (!input.viewerPersonId) return false;
  const principalIds = getPrincipalIds(input.event.id, input.personEvents);
  if (principalIds.includes(input.viewerPersonId)) return true;
  if (!input.event.family_id) return false;
  return input.familyChildren.some(
    (row) => row.family_id === input.event.family_id && row.person_id === input.viewerPersonId,
  );
}

function visibleFamilyIdsFor(input: {
  families: HaFamily[];
  familyParents: HaFamilyParent[];
  familyChildren: HaFamilyChild[];
  visiblePersonIds: Set<string>;
}) {
  const ids = new Set<string>();
  for (const family of input.families) {
    const hasParent = input.familyParents.some(
      (row) => row.family_id === family.id && input.visiblePersonIds.has(row.person_id),
    );
    const hasChild = input.familyChildren.some(
      (row) => row.family_id === family.id && input.visiblePersonIds.has(row.person_id),
    );
    if (hasParent || hasChild) ids.add(family.id);
  }
  return ids;
}

export function buildHomeAssistantUpcomingEvents(input: {
  profile: HaProfile;
  persons: HaPerson[];
  relationships: HaRelationship[];
  families: HaFamily[];
  familyParents: HaFamilyParent[];
  familyChildren: HaFamilyChild[];
  events: HaEvent[];
  personEvents: HaPersonEvent[];
  customEvents?: HaCustomEvent[];
  maxDays?: number;
}) {
  const maxDays = input.maxDays ?? 30;
  const today = startOfLocalDay(getVietnamToday());
  const personById = new Map(input.persons.map((person) => [person.id, person]));
  const out: HomeAssistantUpcomingEvent[] = [];

  const permission = buildVisiblePersonSetForProfile({
    profile: input.profile,
    persons: input.persons,
    relationships: input.relationships,
    families: input.families,
    familyParents: input.familyParents,
    familyChildren: input.familyChildren,
  });

  const visiblePersonIds = permission.visiblePersonIds;
  const visibleFamilies = permission.isRestricted
    ? visibleFamilyIdsFor({
        families: input.families,
        familyParents: input.familyParents,
        familyChildren: input.familyChildren,
        visiblePersonIds,
      })
    : new Set(input.families.map((family) => family.id));

  const eventFilter = permission.isRestricted
    ? filterPersonEventsForVisiblePersons({
        events: input.events,
        personEvents: input.personEvents,
        visiblePersonIds,
        visibleFamilyIds: visibleFamilies,
      })
    : { events: input.events, personEvents: input.personEvents };

  const visiblePersons = permission.isRestricted
    ? input.persons.filter((person) => visiblePersonIds.has(person.id))
    : input.persons;



  for (const person of visiblePersons) {
    if (person.birth_month && person.birth_day) {
      const next = nextYearlyOccurrence(person.birth_month, person.birth_day);
      const daysUntil = differenceInDays(today, next);
      if (daysUntil >= 0 && daysUntil <= maxDays) {
        const msg = buildEventMessage({
          type: "birthday",
          personName: person.full_name,
          daysUntil,
        });
        out.push({
          id: `birthday:${person.id}`,
          source: "person_legacy",
          type: "birthday",
          title: msg.title,
          message: `${msg.emoji} ${msg.message}`,
          emoji: msg.emoji,
          label: msg.label,
          date: isoDate(next),
          daysUntil,
          personId: person.id,
          personName: person.full_name,
          location: null,
          lunarDate: null,
          eventId: null,
        });
      }
    }

    // Ngày mất không còn được xuất thành thông báo Home Assistant.
    // Chỉ event_model type=death_anniversary mới được nhắc hằng năm.
  }

  for (const event of eventFilter.events) {
    if (event.deleted_at) continue;
    if (
      event.type !== "custom" &&
      event.type !== "marriage" &&
      event.type !== "death_anniversary"
    ) {
      continue;
    }

    const eventDate = parseIsoLocalDate(event.start_date || event.sort_date);
    if (!eventDate) continue;

    const principalIds = getPrincipalIds(event.id, eventFilter.personEvents);
    const principalNames = principalIds
      .map((id) => personById.get(id)?.full_name)
      .filter(Boolean) as string[];
    const rootId = getRootId(event.id, eventFilter.personEvents);
    const fallbackPersonId = principalIds[0] ?? rootId ?? null;
    const personName = event.title || principalNames.join(" và ") || "Sự kiện gia đình";

    if (event.type === "death_anniversary") {
      const memorialPersonName =
        principalNames.length > 0 ? principalNames.join(" và ") : "người thân";
      const next = nextMemorialOccurrence(event, eventDate, today);
      if (!next) continue;

      const daysUntil = differenceInDays(today, next);
      if (daysUntil < 0 || daysUntil > maxDays) continue;
      const msg = buildEventMessage({
        type: "death_anniversary",
        personName: memorialPersonName,
        daysUntil,
        content: event.description,
      });
      out.push({
        id: `event:${event.id}:death_anniversary`,
        source: "event_model",
        type: "death_anniversary",
        title: msg.title,
        message: `${msg.emoji} ${msg.message}`,
        emoji: msg.emoji,
        label: msg.label,
        date: isoDate(next),
        daysUntil,
        personId: fallbackPersonId,
        personName: memorialPersonName,
        location: event.place_text ?? null,
        lunarDate: formatLunar(event),
        eventId: event.id,
      });
      continue;
    }

    if (event.type === "marriage") {
      const isFutureOrToday = eventDate.getTime() >= today.getTime();
      if (!isFutureOrToday && permission.isRestricted) {
        const allowed = isDirectMarriageViewer({
          event,
          personEvents: eventFilter.personEvents,
          familyChildren: input.familyChildren,
          viewerPersonId: permission.viewerPersonId,
        });
        if (!allowed) continue;
      }
      const next = isFutureOrToday ? eventDate : nextYearlyOccurrence(eventDate.getMonth() + 1, eventDate.getDate());
      const daysUntil = differenceInDays(today, next);
      if (daysUntil < 0 || daysUntil > maxDays) continue;
      const type = isFutureOrToday ? "marriage_upcoming" : "marriage_anniversary";
      const coupleLabel = principalNames.length > 0 ? principalNames.join(" và ") : personName;
      const msg = buildEventMessage({
        type,
        personName: coupleLabel,
        daysUntil,
        location: event.place_text,
        content: event.description,
      });
      out.push({
        id: `event:${event.id}:${type}`,
        source: "event_model",
        type,
        title: msg.title,
        message: `${msg.emoji} ${msg.message}`,
        emoji: msg.emoji,
        label: msg.label,
        date: isoDate(next),
        daysUntil,
        personId: fallbackPersonId,
        personName: coupleLabel,
        location: event.place_text ?? null,
        lunarDate: formatLunar(event),
        eventId: event.id,
      });
      continue;
    }

    const daysUntil = differenceInDays(today, eventDate);
    if (daysUntil < 0 || daysUntil > maxDays) continue;
    const msg = buildEventMessage({
      type: "custom_event",
      personName,
      daysUntil,
      location: event.place_text,
      content: event.description,
    });
    out.push({
      id: `event:${event.id}`,
      source: "event_model",
      type: "custom_event",
      title: msg.title,
      message: `${msg.emoji} ${msg.message}`,
      emoji: msg.emoji,
      label: msg.label,
      date: isoDate(eventDate),
      daysUntil,
      personId: fallbackPersonId,
      personName,
      location: event.place_text ?? null,
      lunarDate: formatLunar(event),
      eventId: event.id,
    });
  }

  if (!permission.isRestricted) {
    for (const custom of input.customEvents ?? []) {
      const eventDate = parseIsoLocalDate(custom.event_date);
      if (!eventDate) continue;
      const daysUntil = differenceInDays(today, eventDate);
      if (daysUntil < 0 || daysUntil > maxDays) continue;
      const msg = buildEventMessage({
        type: "custom_event",
        personName: custom.name,
        daysUntil,
        location: custom.location,
        content: custom.content,
      });
      out.push({
        id: `custom:${custom.id}`,
        source: "custom_events",
        type: "custom_event",
        title: msg.title,
        message: `${msg.emoji} ${msg.message}`,
        emoji: msg.emoji,
        label: msg.label,
        date: isoDate(eventDate),
        daysUntil,
        personId: null,
        personName: custom.name,
        location: custom.location ?? null,
        lunarDate: null,
        eventId: custom.id,
      });
    }
  }

  out.sort((a, b) => a.daysUntil - b.daysUntil || a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "vi"));

  return {
    permission,
    events: out,
    today: out.filter((event) => event.daysUntil === 0),
    next7Days: out.filter((event) => event.daysUntil >= 0 && event.daysUntil <= 7),
    next30Days: out.filter((event) => event.daysUntil >= 0 && event.daysUntil <= 30),
    summary: {
      today: out.filter((event) => event.daysUntil === 0).length,
      next7Days: out.filter((event) => event.daysUntil >= 0 && event.daysUntil <= 7).length,
      next30Days: out.filter((event) => event.daysUntil >= 0 && event.daysUntil <= 30).length,
      total: out.length,
    },
  };
}
