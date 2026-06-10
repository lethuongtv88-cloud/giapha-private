"use client";

import { createAdminEvent, softDeletePersonEvent } from "@/app/actions/events";
import CustomEventModal from "@/components/modal/CustomEventModal";
import PersonSelector from "@/components/PersonSelector";
import { useMemberListView } from "@/context/MemberListContext";
import type { Person } from "@/types";
import { getZodiacSign } from "@/utils/dateHelpers";
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
import { Solar } from "lunar-javascript";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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
  start_date?: string | null;
  sort_date?: string | null;
  date_precision?: string | null;
  family_id?: string | null;
  legacy_source?: string | null;
  deleted_at?: string | null;
};

type PersonEventLink = {
  person_id: string;
  event_id: string;
  role?: string | null;
};

type ExtendedFamilyEvent = FamilyEvent & {
  eventModelId?: string;
  eventModelRootPersonId?: string | null;
  eventModelType?: "custom" | "marriage";
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
}): ExtendedFamilyEvent[] {
  const today = startOfLocalDay(new Date());
  const personById = new Map(input.persons.map((person) => [person.id, person.full_name]));
  const out: ExtendedFamilyEvent[] = [];

  for (const event of input.events) {
    if (event.deleted_at) continue;
    if (event.type !== "custom" && event.type !== "marriage") continue;

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

    if (event.type === "marriage") {
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
        location: event.place_text ?? undefined,
        content: event.description ?? undefined,
        isDeceased: false,
        eventModelId: event.id,
        eventModelRootPersonId: rootPersonId ?? fallbackPersonId ?? null,
        eventModelType: "marriage",
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
      location: event.place_text ?? undefined,
      content: event.description ?? undefined,
      isDeceased: false,
      eventModelId: event.id,
      eventModelRootPersonId: rootPersonId ?? fallbackPersonId ?? null,
      eventModelType: "custom",
    } as ExtendedFamilyEvent);
  }

  return out;
}

function isMarriageEventType(type: string) {
  return type === "marriage_upcoming" || type === "marriage_anniversary";
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
  const isToday = event.daysUntil === 0;
  const isPast = event.daysUntil < 0;
  const isSoon = event.daysUntil > 0 && event.daysUntil <= 7;
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
          {isMarriage && (
            <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              {event.type === "marriage_upcoming" ? "Đám cưới" : "Kỷ niệm cưới"}
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
                <span className="relative inline-flex rounded-full size-1.5 bg-white" />
              </span>
            )}
            {!isToday && <Clock className="size-2.5" />}
            {daysUntilLabel(event.daysUntil)}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 mt-1">
          <p className="text-[13px] sm:text-sm text-stone-500 flex items-center gap-1.5 leading-snug">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="font-medium text-stone-600">{dateLabel}</span>
            {yearsInfo && <span className="text-stone-400">· {yearsInfo}</span>}
          </p>

          {event.location && (
            <p className="text-[13px] sm:text-sm text-stone-500 flex items-center gap-1.5 leading-snug">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{event.location}</span>
            </p>
          )}
          {event.content && (
            <p className="text-[13px] sm:text-sm text-stone-400 flex items-start gap-1.5 leading-snug mt-0.5">
              <AlignLeft className="size-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{event.content}</span>
            </p>
          )}
        </div>
      </div>

      {canDeleteEventModel ? (
        <button
          type="button"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            onDeleteEventModel(event);
          }}
          disabled={deletingEventId === event.eventModelId}
          className="shrink-0 rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
          title="Xóa sự kiện"
        >
          {deletingEventId === event.eventModelId ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </button>
      ) : null}
    </motion.div>
  );
}

function SharedEventCreateForm({
  persons,
  disabled,
  onCancel,
  onSubmit,
}: {
  persons: Person[];
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (formData: FormData, rootPersonId: string | null) => void;
}) {
  const [precision, setPrecision] = useState("day");
  const [rootPersonId, setRootPersonId] = useState<string | null>(null);

  return (
    <form
      action={(formData) => onSubmit(formData, rootPersonId)}
      className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 shadow-inner"
    >
      <input type="hidden" name="type" value="custom" />
      <input type="hidden" name="date_precision" value={precision} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-stone-800">Thêm sự kiện chung</h3>
          <p className="text-xs text-stone-500">
            Chọn gốc hiển thị để thành viên trong nhánh được phép có thể thấy sự kiện này.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-2 text-stone-400 transition hover:bg-white hover:text-stone-700"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <PersonSelector
            persons={persons}
            selectedId={rootPersonId}
            onSelect={setRootPersonId}
            label="Gốc hiển thị"
            placeholder="Chọn người gốc trong nhánh được xem"
            className="w-full"
          />
        </div>

        <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
          Tiêu đề
          <input
            name="title"
            required
            placeholder="Ví dụ: Họp mặt gia đình, Cúng giỗ, Lễ truyền thống..."
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Độ chính xác ngày
          <select
            value={precision}
            onChange={(event) => setPrecision(event.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="day">Chính xác ngày</option>
            <option value="month">Chỉ tháng/năm</option>
            <option value="year">Chỉ năm</option>
            <option value="unknown">Không rõ ngày</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Ngày dương lịch
          <input
            name="date_text"
            type={precision === "day" ? "date" : precision === "month" ? "month" : "text"}
            disabled={precision === "unknown"}
            placeholder={precision === "year" ? "yyyy" : precision === "month" ? "mm/yyyy" : "dd/mm/yyyy"}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-stone-100 disabled:text-stone-400"
          />
        </label>

        <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
          Địa điểm
          <input
            name="place_text"
            placeholder="Nơi diễn ra nếu có"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>

        <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
          Nội dung / ghi chú
          <textarea
            name="description"
            rows={3}
            placeholder="Nội dung thông báo sự kiện"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn" disabled={disabled}>
          Hủy
        </button>
        <button type="submit" className="btn-primary" disabled={disabled}>
          {disabled ? "Đang lưu..." : "Lưu sự kiện"}
        </button>
      </div>
    </form>
  );
}

export default function EventsList({
  persons,
  customEvents = [],
  eventModelEvents = [],
  personEvents = [],
  selectorPersons = [],
  canCreateEvent = false,
}: EventsListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showCount, setShowCount] = useState(20);
  const [showDeceasedBirthdays, setShowDeceasedBirthdays] = useState(false);
  const [isLegacyModalOpen, setIsLegacyModalOpen] = useState(false);
  const [editingCustomEvent, setEditingCustomEvent] =
    useState<CustomEventRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenEditModal = (event: ExtendedFamilyEvent) => {
    if (event.eventModelId) return;
    const rawEvent = customEvents.find((ce) => ce.id === event.personId);
    if (rawEvent) {
      setEditingCustomEvent(rawEvent);
      setIsLegacyModalOpen(true);
    }
  };

  const handleCreateSharedEvent = (formData: FormData, rootPersonId: string | null) => {
    setCreateError(null);
    setCreateMessage(null);

    if (!rootPersonId) {
      setCreateError("Vui lòng chọn Gốc hiển thị cho sự kiện.");
      return;
    }

    formData.set("root_person_id", rootPersonId);

    startTransition(() => {
      void (async () => {
        const result = await createAdminEvent(formData);

        if (!result) {
          setCreateError("Không nhận được phản hồi sau khi tạo sự kiện.");
          return;
        }

        if ("error" in result && result.error) {
          setCreateError(result.error);
          return;
        }

        const auditOk = "auditOk" in result ? result.auditOk : true;
        const auditError = "auditError" in result ? result.auditError : null;

        setCreateMessage(
          auditOk === false
            ? `Đã thêm sự kiện, nhưng audit log chưa ghi được: ${auditError ?? "không rõ lỗi"}`
            : "Đã thêm sự kiện.",
        );
        setIsCreateOpen(false);
        router.refresh();
      })();
    });
  };

  const handleDeleteEventModel = (event: ExtendedFamilyEvent) => {
    if (!event.eventModelId || !event.eventModelRootPersonId) return;

    const confirmed = window.confirm("Bạn chắc chắn muốn xóa sự kiện này?");
    if (!confirmed) return;

    setDeletingEventId(event.eventModelId);
    startTransition(() => {
      void (async () => {
        const result = await softDeletePersonEvent({
          personId: event.eventModelRootPersonId!,
          eventId: event.eventModelId!,
        });

        if (result?.error) {
          setCreateError(result.error);
        } else {
          setCreateMessage("Đã xóa sự kiện.");
          router.refresh();
        }

        setDeletingEventId(null);
      })();
    });
  };

  const handleModalSuccess = () => {
    router.refresh();
  };

  const [todayDate] = useState(() => {
    const today = new Date();
    const weekdays = [
      "Chủ nhật",
      "Thứ hai",
      "Thứ ba",
      "Thứ tư",
      "Thứ năm",
      "Thứ sáu",
      "Thứ bảy",
    ];
    const dayOfWeek = weekdays[today.getDay()];
    const solarStr = `${dayOfWeek}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
    let lunarStr = "";
    try {
      const solar = Solar.fromYmd(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate(),
      );
      const lunar = solar.getLunar();
      const lMonthRaw = lunar.getMonth();
      const isLeap = lMonthRaw < 0;
      const lMonth = Math.abs(lMonthRaw).toString().padStart(2, "0");
      const lDay = lunar.getDay().toString().padStart(2, "0");
      lunarStr = `${lDay}/${lMonth}${isLeap ? " nhuận" : ""} ÂL`;
    } catch (e) {
      console.error(e);
    }
    return { solar: solarStr, lunar: lunarStr };
  });

  const allEvents = useMemo(() => {
    const baseEvents = computeEvents(persons, customEvents) as ExtendedFamilyEvent[];
    const modelEvents = buildEventModelEvents({
      events: eventModelEvents,
      personEvents,
      persons,
    });

    return [...baseEvents, ...modelEvents].sort(
      (a, b) => a.daysUntil - b.daysUntil || a.nextOccurrence.getTime() - b.nextOccurrence.getTime(),
    );
  }, [persons, customEvents, eventModelEvents, personEvents]);

  const filtered = useMemo(() => {
    let result = allEvents;
    if (filter === "past") {
      return result
        .filter((e) => e.daysUntil < 0 && e.daysUntil >= -365)
        .sort((a, b) => b.daysUntil - a.daysUntil);
    }
    if (filter === "marriage") {
      result = result.filter((e) => isMarriageEventType(String(e.type)));
    } else if (filter !== "all") {
      result = result.filter((e) => e.type === filter);
    }
    if (!showDeceasedBirthdays) {
      result = result.filter((e) => !(e.type === "birthday" && e.isDeceased));
    }
    return result.filter((e) => e.daysUntil >= 0 && e.daysUntil <= 365);
  }, [allEvents, filter, showDeceasedBirthdays]);

  const visible = filtered.slice(0, showCount);

  const todayCount = allEvents.filter((e) => e.daysUntil === 0).length;
  const soonCount = allEvents.filter(
    (e) => e.daysUntil > 0 && e.daysUntil <= 7,
  ).length;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-white border border-stone-200/60 shadow-sm hover:shadow-stone-100 hover:border-stone-400 transition-all duration-300 mb-8 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-50"></div>

        <div className="relative flex items-center gap-4 sm:gap-6">
          <div className="size-16 rounded-2xl bg-stone-50 flex items-center justify-center shrink-0 border border-stone-100 shadow-sm text-stone-600">
            <CalendarDays className="size-8" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-bold text-stone-800 tracking-tight">
              {todayDate.solar}
            </p>
            {todayDate.lunar && (
              <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 px-3.5 py-1 rounded-full bg-stone-50 border border-stone-100">
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Âm lịch:
                </span>
                <span className="text-sm font-semibold text-stone-700">
                  {todayDate.lunar}
                </span>
              </div>
            )}
            {(todayCount > 0 || soonCount > 0) && (
              <p className="text-sm text-stone-500 mt-3 flex items-start sm:items-center gap-2.5 font-medium">
                <span className="relative flex size-2.5 shrink-0 mt-1 sm:mt-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2.5 bg-amber-500"></span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {todayCount > 0 && (
                    <span className="font-semibold text-stone-700">
                      {todayCount} sự kiện hôm nay
                    </span>
                  )}
                  {todayCount > 0 && soonCount > 0 && (
                    <span className="hidden sm:inline">·</span>
                  )}
                  {soonCount > 0 && (
                    <span>{soonCount} sự kiện trong 7 ngày tới</span>
                  )}
                </span>
              </p>
            )}
          </div>
        </div>

        {canCreateEvent ? (
          <button
            onClick={() => {
              setCreateError(null);
              setCreateMessage(null);
              setIsCreateOpen((value) => !value);
            }}
            className="relative z-10 w-full sm:w-auto px-5 py-3 rounded-xl bg-stone-800 text-white font-semibold hover:bg-stone-900 active:scale-95 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            disabled={isPending}
          >
            {isCreateOpen ? <X className="size-5 text-stone-300" /> : <Plus className="size-5 text-stone-300" />}
            <span>{isCreateOpen ? "Đóng" : "Thêm sự kiện"}</span>
          </button>
        ) : null}
      </motion.div>

      {createMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {createMessage}
        </div>
      ) : null}
      {createError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {createError}
        </div>
      ) : null}
      {isCreateOpen ? (
        <SharedEventCreateForm
          persons={selectorPersons}
          disabled={isPending}
          onCancel={() => setIsCreateOpen(false)}
          onSubmit={handleCreateSharedEvent}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setFilter(tab.key);
                setShowCount(20);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filter === tab.key
                ? filter === "past"
                  ? "bg-stone-600 text-white shadow-sm"
                  : "bg-amber-500 text-white shadow-sm"
                : "bg-white/80 text-stone-600 border border-stone-200/60 hover:border-amber-200 hover:text-amber-700"
                }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-stone-400 self-center">
            {filtered.length} sự kiện{filter === "past" ? " trong năm qua" : ""}
          </span>
        </div>

        {filter !== "past" && (
          <div className="flex px-1">
            <label className="flex items-center gap-2.5 text-sm font-medium text-stone-600 cursor-pointer hover:text-stone-900 transition-colors select-none">
              <input
                type="checkbox"
                checked={showDeceasedBirthdays}
                onChange={(e) => setShowDeceasedBirthdays(e.target.checked)}
                className="rounded-md border-stone-300 text-amber-500 focus:ring-amber-500 size-4 transition-all"
              />
              Hiển thị sinh nhật của người đã mất
            </label>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <CalendarDays className="size-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Không có sự kiện nào</p>
          <p className="text-sm mt-1">
            Hãy bổ sung ngày sinh, ngày mất hoặc sự kiện chung cho thành viên
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((event, i) => (
            <EventCard
              key={`${event.eventModelId ?? event.personId}-${event.type}-${event.eventDateLabel}`}
              event={event}
              index={i}
              onEditCustomEvent={handleOpenEditModal}
              onDeleteEventModel={handleDeleteEventModel}
              deletingEventId={deletingEventId}
            />
          ))}
        </div>
      )}

      {filtered.length > showCount && (
        <button
          onClick={() => setShowCount((n) => n + 20)}
          className="w-full py-3 text-sm font-semibold text-stone-500 hover:text-amber-600 transition-colors"
        >
          Xem thêm {filtered.length - showCount} sự kiện…
        </button>
      )}

      <CustomEventModal
        isOpen={isLegacyModalOpen}
        onClose={() => setIsLegacyModalOpen(false)}
        onSuccess={handleModalSuccess}
        eventToEdit={editingCustomEvent}
      />
    </div>
  );
}
