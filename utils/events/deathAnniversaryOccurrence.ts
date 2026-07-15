import { Lunar, Solar } from "lunar-javascript";
import type { FamilyEvent } from "@/utils/eventHelpers";

export interface DeathAnniversaryEventRecord {
  id: string;
  type: string;
  start_date: string | null;
  sort_date: string | null;
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_is_leap_month?: boolean | null;
  description?: string | null;
  place_text?: string | null;
  deleted_at?: string | null;
}

export interface PersonEventLinkRecord {
  event_id: string;
  person_id: string;
  role?: string | null;
}

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

function differenceInDays(from: Date, to: Date) {
  const ms = startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

function nextYearlyOccurrence(month: number, day: number) {
  const today = startOfLocalDay(new Date());
  let occurrence = startOfLocalDay(new Date(today.getFullYear(), month - 1, day));

  if (occurrence.getTime() < today.getTime()) {
    occurrence = startOfLocalDay(new Date(today.getFullYear() + 1, month - 1, day));
  }

  return occurrence;
}

function nextSolarForLunar(lunarMonth: number, lunarDay: number, fromDate: Date, isLeapMonth = false) {
  try {
    const todaySolar = Solar.fromYmd(fromDate.getFullYear(), fromDate.getMonth() + 1, fromDate.getDate());
    const currentLunarYear = todaySolar.getLunar().getYear();
    const lunarMonthValue = isLeapMonth ? -lunarMonth : lunarMonth;

    for (let offset = 0; offset <= 2; offset += 1) {
      try {
        const lunar = Lunar.fromYmd(currentLunarYear + offset, lunarMonthValue, lunarDay);
        const solar = lunar.getSolar();
        const candidate = startOfLocalDay(new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay()));
        if (candidate.getTime() >= startOfLocalDay(fromDate).getTime()) return candidate;
      } catch {
        // Leap lunar months do not exist every year; try the next lunar year.
      }
    }
  } catch (error) {
    console.error(error);
  }

  return null;
}

function nextMemorialOccurrence(event: DeathAnniversaryEventRecord, eventDate: Date, today: Date) {
  if (event.lunar_month && event.lunar_day) {
    return nextSolarForLunar(event.lunar_month, event.lunar_day, today, Boolean(event.lunar_is_leap_month));
  }

  return nextYearlyOccurrence(eventDate.getMonth() + 1, eventDate.getDate());
}

function getRootPersonId(eventId: string, personEvents: PersonEventLinkRecord[]) {
  return personEvents.find((row) => row.event_id === eventId && row.role === "visibility_root")?.person_id ?? null;
}

function getFallbackPersonId(eventId: string, personEvents: PersonEventLinkRecord[]) {
  return personEvents.find((row) => row.event_id === eventId)?.person_id ?? null;
}

function getPrincipalNames(input: {
  eventId: string;
  personEvents: PersonEventLinkRecord[];
  personById: Map<string, string>;
}) {
  return input.personEvents
    .filter((row) => row.event_id === input.eventId)
    .filter((row) => row.role !== "visibility_root")
    .map((row) => input.personById.get(row.person_id))
    .filter(Boolean) as string[];
}

/**
 * Tính danh sách "ngày giỗ" (death_anniversary) sắp tới từ dữ liệu event_model
 * (bảng `events` + `person_events`), dùng chung cho trang Sự kiện và khung
 * "Sự kiện sắp tới" ở dashboard — để 2 nơi luôn hiển thị đồng nhất.
 */
export function computeDeathAnniversaryEvents(input: {
  events: DeathAnniversaryEventRecord[];
  personEvents: PersonEventLinkRecord[];
  persons: { id: string; full_name: string }[];
}): FamilyEvent[] {
  const today = startOfLocalDay(new Date());
  const personById = new Map(input.persons.map((person) => [person.id, person.full_name]));
  const out: FamilyEvent[] = [];

  for (const event of input.events) {
    if (event.deleted_at) continue;
    if (event.type !== "death_anniversary") continue;

    const eventDate = parseIsoLocalDate(event.start_date || event.sort_date);
    if (!eventDate) continue;

    const nextOccurrence = nextMemorialOccurrence(event, eventDate, today);
    if (!nextOccurrence) continue;

    const rootPersonId = getRootPersonId(event.id, input.personEvents);
    const fallbackPersonId = getFallbackPersonId(event.id, input.personEvents);
    const names = getPrincipalNames({ eventId: event.id, personEvents: input.personEvents, personById });
    const principalName = names[0] || "người thân";

    const originYear = eventDate.getFullYear();
    const originMonth = eventDate.getMonth() + 1;
    const originDay = eventDate.getDate();
    const daysUntil = differenceInDays(today, nextOccurrence);
    const memorialDateLabel =
      event.lunar_month && event.lunar_day
        ? `${String(event.lunar_day).padStart(2, "0")}/${String(event.lunar_month).padStart(2, "0")}${event.lunar_is_leap_month ? " nhuận" : ""} ÂL`
        : `${String(originDay).padStart(2, "0")}/${String(originMonth).padStart(2, "0")}`;

    out.push({
      personId: fallbackPersonId ?? rootPersonId ?? null,
      personName: principalName,
      type: "death_anniversary",
      nextOccurrence,
      daysUntil,
      eventDateLabel: memorialDateLabel,
      originYear: event.lunar_year ?? originYear,
      originMonth: event.lunar_month ?? originMonth,
      originDay: event.lunar_day ?? originDay,
      isDeceased: true,
      location: event.place_text ?? null,
      content: event.description ?? null,
    });
  }

  return out;
}
