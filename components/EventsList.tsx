"use client";

import { createAdminEvent, softDeletePersonEvent } from "@/app/actions/events";
import CustomEventModal from "@/components/modal/CustomEventModal";
import PersonSelector from "@/components/PersonSelector";
import PlaceSelector from "@/components/places/PlaceSelector";
import PlaceMapLinks, { type PlaceForMapLinks } from "@/components/places/PlaceMapLinks";
import { useMemberListView } from "@/context/MemberListContext";
import type { Person } from "@/types";
import { getZodiacSign } from "@/utils/dateHelpers";
import { buildEventMessage } from "@/utils/events/eventMessages";
import {
  computeEvents,
  CustomEventRecord,
  FamilyEvent,
} from "@/utils/eventHelpers";
import { motion } from "framer-motion";
import {
  AlignLeft,
  Cake,
  CalendarDays,
  Clock,
  Flower,
  Loader2,
  MapPin,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Lunar, Solar } from "lunar-javascript";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";

interface EventsListProps {
  persons: {
    id: string;
    full_name: string;
    birth_year: number | null;
    birth_month: number | null;
    birth_day: number | null;
    death_year: number | null;
    death_month: number | null;
    death_day: number | null;
    death_lunar_year: number | null;
    death_lunar_month: number | null;
    death_lunar_day: number | null;
    is_deceased: boolean;
  }[];
  customEvents?: CustomEventRecord[];
  eventModelEvents?: EventModelRecord[];
  personEvents?: PersonEventLink[];
  selectorPersons?: Person[];
  canCreateEvent?: boolean;
}

type EventModelRecord = {
  id: string;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  place_text?: string | null;
  place_id?: string | null;
  start_date?: string | null;
  sort_date?: string | null;
  date_precision?: string | null;
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_is_leap_month?: boolean | null;
  canonical_calendar?: string | null;
  family_id?: string | null;
  legacy_source?: string | null;
  deleted_at?: string | null;
};

type PersonEventLink = {
  person_id: string;
  event_id: string;
  role?: string | null;
};

type StructuredPlace = PlaceForMapLinks & { id: string };

type ExtendedFamilyEvent = Omit<FamilyEvent, "type"> & {
  type: FamilyEvent["type"] | "marriage_upcoming" | "marriage_anniversary" | "death_recent";
  eventModelId?: string;
  eventModelRootPersonId?: string | null;
  eventModelType?: "custom" | "marriage" | "death_anniversary" | "wedding";
  lunarDateLabel?: string | null;
  eventModelPlaceId?: string | null;
  structuredPlace?: StructuredPlace | null;
};

const DAY_LABELS: Record<string, string> = {
  "-1": "Hôm qua",
  "0": "Hôm nay",
  "1": "Ngày mai",
};

const FILTER_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "birthday", label: "Sinh nhật" },
  { key: "death_anniversary", label: "Ngày giỗ" },
  { key: "marriage", label: "Cưới / kỷ niệm cưới" },
  { key: "custom_event", label: "Tuỳ chỉnh" },
  { key: "past", label: "Đã qua" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function daysUntilLabel(days: number): string {
  if (days.toString() in DAY_LABELS) return DAY_LABELS[days.toString()];
  if (days < 0) {
    const abs = Math.abs(days);
    if (abs <= 30) return `${abs} ngày trước`;
    if (abs <= 60) return `${Math.ceil(abs / 7)} tuần trước`;
    return `${Math.ceil(abs / 30)} tháng trước`;
  }
  if (days <= 30) return `${days} ngày nữa`;
  if (days <= 60) return `${Math.ceil(days / 7)} tuần nữa`;
  return `${Math.ceil(days / 30)} tháng nữa`;
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

function formatLunarEventLabel(event: {
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_is_leap_month?: boolean | null;
}) {
  if (!event.lunar_year && !event.lunar_month && !event.lunar_day) return null;

  const day = event.lunar_day ? String(event.lunar_day).padStart(2, "0") : "??";
  const month = event.lunar_month ? String(event.lunar_month).padStart(2, "0") : "??";
  const year = event.lunar_year ? String(event.lunar_year) : "????";
  const leap = event.lunar_is_leap_month ? " nhuận" : "";

  return `${day}/${month}/${year}${leap} ÂL`;
}

function parseLunarDateText(value: string) {
  const raw = value.trim();
  const ddmmyyyy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  const yyyymmdd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (ddmmyyyy) {
    return {
      day: Number(ddmmyyyy[1]),
      month: Number(ddmmyyyy[2]),
      year: Number(ddmmyyyy[3]),
    };
  }

  if (yyyymmdd) {
    return {
      year: Number(yyyymmdd[1]),
      month: Number(yyyymmdd[2]),
      day: Number(yyyymmdd[3]),
    };
  }

  return null;
}

function lunarToSolarIso(input: { year: number; month: number; day: number; isLeap: boolean }) {
  if (input.month < 1 || input.month > 12) return null;
  if (input.day < 1 || input.day > 30) return null;

  try {
    const lunarMonth = input.isLeap ? -input.month : input.month;
    const solar = Lunar.fromYmd(input.year, lunarMonth, input.day).getSolar();
    return `${String(solar.getYear()).padStart(4, "0")}-${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}`;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function differenceInDays(from: Date, to: Date) {
  const ms = startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

function nextYearlyOccurrence(month: number, day: number) {
  const today = startOfLocalDay(new Date());
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
  } catch (error) {
    console.error(error);
  }

  return null;
}

function nextMemorialOccurrence(event: EventModelRecord, eventDate: Date, today: Date) {
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

function getPrincipalNames(input: {
  eventId: string;
  personEvents: PersonEventLink[];
  personById: Map<string, string>;
}) {
  return input.personEvents
    .filter((row) => row.event_id === input.eventId)
    .filter((row) => row.role !== "visibility_root")
    .map((row) => input.personById.get(row.person_id))
    .filter(Boolean) as string[];
}

function getRootPersonId(eventId: string, personEvents: PersonEventLink[]) {
  return (
    personEvents.find(
      (row) => row.event_id === eventId && row.role === "visibility_root",
    )?.person_id ?? null
  );
}

function getFallbackPersonId(eventId: string, personEvents: PersonEventLink[]) {
  return personEvents.find((row) => row.event_id === eventId)?.person_id ?? null;
}

function buildEventModelEvents(input: {
  events: EventModelRecord[];
  personEvents: PersonEventLink[];
  persons: EventsListProps["persons"];
  placesById: Map<string, StructuredPlace>;
}): ExtendedFamilyEvent[] {
  const today = startOfLocalDay(new Date());
  const personById = new Map(input.persons.map((person) => [person.id, person.full_name]));
  const out: ExtendedFamilyEvent[] = [];

  for (const event of input.events) {
    if (event.deleted_at) continue;
    if (
      event.type !== "custom" &&
      event.type !== "marriage" &&
      event.type !== "wedding" &&
      event.type !== "death_anniversary"
    ) {
      continue;
    }

    const eventDate = parseIsoLocalDate(event.start_date || event.sort_date);
    if (!eventDate) continue;

    const rootPersonId = getRootPersonId(event.id, input.personEvents);
    const fallbackPersonId = getFallbackPersonId(event.id, input.personEvents);
    const names = getPrincipalNames({
      eventId: event.id,
      personEvents: input.personEvents,
      personById,
    });

    const originYear = eventDate.getFullYear();
    const originMonth = eventDate.getMonth() + 1;
    const originDay = eventDate.getDate();
    const lunarDateLabel = formatLunarEventLabel(event);
    const structuredPlace = event.place_id
      ? input.placesById.get(event.place_id) ?? null
      : null;
    const displayLocation = structuredPlace?.name ?? event.place_text ?? undefined;

    if (event.type === "death_anniversary") {
      const nextOccurrence = nextMemorialOccurrence(event, eventDate, today);
      if (!nextOccurrence) continue;

      const daysUntil = differenceInDays(today, nextOccurrence);
      const principalName = names[0] || "người thân";
      const memorialDateLabel = event.lunar_month && event.lunar_day
        ? `${String(event.lunar_day).padStart(2, "0")}/${String(event.lunar_month).padStart(2, "0")}${event.lunar_is_leap_month ? " nhuận" : ""} ÂL`
        : `${String(originDay).padStart(2, "0")}/${String(originMonth).padStart(2, "0")}`;

      out.push({
        type: "death_anniversary",
        personId: fallbackPersonId ?? rootPersonId ?? undefined,
        personName: principalName,
        nextOccurrence,
        daysUntil,
        originYear: event.lunar_year ?? originYear,
        originMonth: event.lunar_month ?? originMonth,
        originDay: event.lunar_day ?? originDay,
        eventDateLabel: memorialDateLabel,
        lunarDateLabel,
        location: displayLocation,
        content: event.description ?? undefined,
        isDeceased: true,
        eventModelId: event.id,
        eventModelRootPersonId: rootPersonId ?? fallbackPersonId ?? null,
        eventModelType: "death_anniversary",
        eventModelPlaceId: event.place_id ?? null,
        structuredPlace,
      } as ExtendedFamilyEvent);

      continue;
    }

    if (event.type === "marriage" || event.type === "wedding") {
      const isFutureOrToday = eventDate.getTime() >= today.getTime();
      const nextOccurrence = isFutureOrToday
        ? eventDate
        : nextYearlyOccurrence(originMonth, originDay);
      const daysUntil = differenceInDays(today, nextOccurrence);
      const coupleLabel = names.length > 0 ? names.join(" và ") : "sự kiện kết hôn";

      out.push({
        type: isFutureOrToday ? "marriage_upcoming" : "marriage_anniversary",
        personId: fallbackPersonId ?? rootPersonId ?? undefined,
        personName:
          event.title ||
          (isFutureOrToday
            ? `Đám cưới ${coupleLabel}`
            : `Kỷ niệm ngày cưới ${coupleLabel}`),
        nextOccurrence,
        daysUntil,
        originYear,
        originMonth,
        originDay,
        eventDateLabel: `${String(originDay).padStart(2, "0")}/${String(originMonth).padStart(2, "0")}`,
        lunarDateLabel,
        location: displayLocation,
        content: event.description ?? undefined,
        isDeceased: false,
        eventModelId: event.id,
        eventModelRootPersonId: rootPersonId ?? fallbackPersonId ?? null,
        eventModelType: event.type === "wedding" ? "wedding" : "marriage",
        eventModelPlaceId: event.place_id ?? null,
        structuredPlace,
      } as ExtendedFamilyEvent);

      continue;
    }

    out.push({
      type: "custom_event",
      personId: rootPersonId ?? fallbackPersonId ?? event.id,
      personName: event.title || "Sự kiện gia đình",
      nextOccurrence: eventDate,
      daysUntil: differenceInDays(today, eventDate),
      originYear,
      originMonth,
      originDay,
      eventDateLabel: `${String(originDay).padStart(2, "0")}/${String(originMonth).padStart(2, "0")}/${originYear}`,
      lunarDateLabel,
      location: displayLocation,
      content: event.description ?? undefined,
      isDeceased: false,
      eventModelId: event.id,
      eventModelRootPersonId: rootPersonId ?? fallbackPersonId ?? null,
      eventModelType: "custom",
      eventModelPlaceId: event.place_id ?? null,
      structuredPlace,
    } as ExtendedFamilyEvent);
  }

  return out;
}

function isMarriageEventType(type: string) {
  return type === "marriage_upcoming" || type === "marriage_anniversary";
}

function isMemorialEventType(type: string) {
  return type === "death_anniversary";
}

function EventCard({
  event,
  index,
  onEditCustomEvent,
  onDeleteEventModel,
  deletingEventId,
}: {
  event: ExtendedFamilyEvent;
  index: number;
  onEditCustomEvent: (e: ExtendedFamilyEvent) => void;
  onDeleteEventModel: (e: ExtendedFamilyEvent) => void;
  deletingEventId: string | null;
}) {
  const isBirthday = event.type === "birthday";
  const isCustom = event.type === "custom_event";
  const isMarriage = isMarriageEventType(String(event.type));
  const isMemorial = isMemorialEventType(String(event.type));
  const eventMessage = buildEventMessage({
    type: String(event.type),
    personName: event.personName,
    daysUntil: event.daysUntil,
    eventDateLabel: event.eventDateLabel,
    location: event.location,
    content: event.content,
  });
  const isToday = event.daysUntil === 0;
  const isPast = event.daysUntil < 0;
  const isSoon = event.daysUntil > 0 && event.daysUntil <= 7;
  const shouldShowEventMessage =
    (event.daysUntil >= 0 && event.daysUntil < 5) ||
    (event.type === "death_recent" && event.daysUntil >= -5);
  const canDeleteEventModel = Boolean(event.eventModelId && event.eventModelRootPersonId);

  const { setMemberModalId } = useMemberListView();

  const handleClick = () => {
    if (event.eventModelId) {
      if (event.personId) setMemberModalId(event.personId);
      return;
    }

    if (isCustom) {
      onEditCustomEvent(event);
    } else if (event.personId) {
      setMemberModalId(event.personId);
    }
  };

  const yearsInfo = (() => {
    if (!event.originYear) return null;
    const now = new Date().getFullYear();
    const diff = now - event.originYear;
    if (diff <= 0) return null;
    if (isBirthday) return `${diff} tuổi`;
    if (event.type === "death_anniversary") return `${diff} năm`;
    if (event.type === "marriage_anniversary") return `${diff} năm`;
    return null;
  })();

  const dateLabel = (() => {
    const weekdays = [
      "Chủ nhật",
      "Thứ hai",
      "Thứ ba",
      "Thứ tư",
      "Thứ năm",
      "Thứ sáu",
      "Thứ bảy",
    ];
    const d = event.nextOccurrence;
    const dayOfWeek = weekdays[d.getDay()];
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();

    let label = `${dayOfWeek}, ngày ${day}/${month}`;
    if (event.type === "custom_event" || event.type === "marriage_upcoming") {
      label += `/${year}`;
    }
    if (event.type === "death_anniversary") {
      label += ` (Âm lịch: ${event.eventDateLabel.replace(" ÂL", "")})`;
    } else if (event.lunarDateLabel) {
      label += ` · ${event.lunarDateLabel}`;
    }
    return label;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      onClick={handleClick}
      className={`w-full text-left flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] hover:shadow-md group ${isToday
        ? "bg-amber-50 border-amber-300 shadow-sm"
        : isPast
          ? "bg-stone-50/60 border-stone-200/50"
          : isBirthday
            ? "bg-white/80 border-stone-200/60 hover:border-blue-200"
            : isCustom
              ? "bg-white/80 border-stone-200/60 hover:border-purple-200"
              : isMarriage
                ? "bg-white/80 border-stone-200/60 hover:border-amber-200"
                : "bg-white/80 border-stone-200/60 hover:border-rose-200"
        }`}
    >
      <div
        className={`shrink-0 size-10 sm:size-11 flex items-center justify-center rounded-xl ${isToday
          ? "bg-amber-100 text-amber-600"
          : isPast
            ? "bg-stone-100 text-stone-400"
            : isBirthday
              ? "bg-blue-50 text-blue-500"
              : isCustom
                ? "bg-purple-50 text-purple-500"
                : isMarriage
                  ? "bg-amber-50 text-amber-600"
                  : "bg-rose-50 text-rose-500"
          }`}
      >
        {isBirthday ? (
          <Cake className="size-[18px] sm:size-5" />
        ) : isCustom ? (
          <Star className="size-[18px] sm:size-5" />
        ) : isMarriage ? (
          <CalendarDays className="size-[18px] sm:size-5" />
        ) : (
          <Flower className="size-[18px] sm:size-5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className={`font-semibold text-[15px] sm:text-base truncate transition-colors ${isPast
              ? "text-stone-500"
              : "text-stone-800 group-hover:text-amber-700"
              }`}
          >
            {event.personName}
          </p>
          {isBirthday &&
            event.originDay &&
            event.originMonth &&
            getZodiacSign(event.originDay, event.originMonth) && (
              <span className="shrink-0 text-[10px] font-sans font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 rounded-md px-1.5 py-0.5 whitespace-nowrap shadow-xs tracking-wider">
                {getZodiacSign(event.originDay, event.originMonth)}
              </span>
            )}
          {(isMarriage || isMemorial || isBirthday || isCustom) && (
            <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              {eventMessage.label}
            </span>
          )}
          <span
            className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold leading-tight whitespace-nowrap ${isToday
              ? "bg-amber-400 text-white"
              : isPast
                ? "bg-stone-200/80 text-stone-500"
                : isSoon
                  ? "bg-red-100 text-red-600"
                  : "bg-stone-100 text-stone-500"
              }`}
          >
            {isToday && (
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75" />
                <span className="relative in