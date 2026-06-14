"use client";

import {
  createPersonEvent,
  softDeletePersonEvent,
  updatePersonEvent,
} from "@/app/actions/events";
import PersonSelector from "@/components/PersonSelector";
import { EventSourcesPanel } from "@/components/EventSourcesPanel";
import { PersonTimeline, type TimelineEvent } from "@/components/PersonTimeline";
import type { Person } from "@/types";
import { createClient } from "@/utils/supabase/client";
import { BookOpen, CalendarDays, Edit3, Plus, Trash2, X } from "lucide-react";
import { Lunar } from "lunar-javascript";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type PersonEventsPanelProps = {
  personId: string;
  canEdit?: boolean;
  className?: string;
};

type EditableTimelineEvent = TimelineEvent & {
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_is_leap_month?: boolean | null;
};

type EditingState =
  | { mode: "create"; event: null }
  | { mode: "edit"; event: EditableTimelineEvent };

const EVENT_TYPES = [
  { value: "birth", label: "Sinh" },
  { value: "death", label: "Mất" },
  { value: "death_anniversary", label: "Ngày giỗ" },
  { value: "marriage", label: "Kết hôn" },
  { value: "divorce", label: "Ly hôn" },
  { value: "burial", label: "An táng" },
  { value: "residence", label: "Cư trú" },
  { value: "occupation", label: "Nghề nghiệp" },
  { value: "migration", label: "Di cư" },
  { value: "military", label: "Quân ngũ" },
  { value: "custom", label: "Ngày kỵ / Khác" },
];

const PRECISIONS = [
  { value: "day", label: "Chính xác ngày", placeholder: "dd/mm/yyyy, ví dụ 21/07/2015" },
  { value: "month", label: "Chỉ tháng/năm", placeholder: "mm/yyyy, ví dụ 07/2015" },
  { value: "year", label: "Chỉ năm", placeholder: "yyyy, ví dụ 2015" },
  { value: "unknown", label: "Không rõ ngày", placeholder: "Để trống" },
];

function toPersonSelectorRows(rows: Partial<Person>[]) {
  return rows.map((person) => ({
    id: person.id ?? "",
    full_name: person.full_name ?? "Không rõ tên",
    gender: person.gender === "female" || person.gender === "male" ? person.gender : "other",
    birth_year: person.birth_year ?? null,
    birth_month: person.birth_month ?? null,
    birth_day: person.birth_day ?? null,
    death_year: person.death_year ?? null,
    death_month: person.death_month ?? null,
    death_day: person.death_day ?? null,
    avatar_url: person.avatar_url ?? null,
    note: person.note ?? null,
    created_at: person.created_at ?? "",
    updated_at: person.updated_at ?? "",
    death_lunar_year: person.death_lunar_year ?? null,
    death_lunar_month: person.death_lunar_month ?? null,
    death_lunar_day: person.death_lunar_day ?? null,
    is_deceased: person.is_deceased ?? false,
    is_in_law: person.is_in_law ?? false,
    birth_order: person.birth_order ?? null,
    generation: person.generation ?? null,
    other_names: person.other_names ?? null,
  })) as Person[];
}

export default function PersonEventsPanel({
  personId,
  canEdit = false,
  className,
}: PersonEventsPanelProps) {
  const [events, setEvents] = useState<EditableTimelineEvent[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [sourceEvent, setSourceEvent] = useState<EditableTimelineEvent | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPersons = useCallback(async () => {
    if (!canEdit) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("persons_active")
      .select(
        "id, full_name, gender, birth_year, birth_month, birth_day, death_year, death_month, death_day, death_lunar_year, death_lunar_month, death_lunar_day, is_deceased, is_in_law, birth_order, generation, other_names, avatar_url, note, created_at, updated_at",
      )
      .order("full_name", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setPersons(toPersonSelectorRows(data ?? []));
  }, [canEdit]);

  const loadEvents = useCallback(async () => {
    if (!personId) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: personEvents, error: personEventsError } = await supabase
        .from("person_events")
        .select("event_id")
        .eq("person_id", personId);

      if (personEventsError) {
        setError(personEventsError.message);
        return;
      }

      const eventIds = Array.from(
        new Set((personEvents ?? []).map((row) => row.event_id).filter(Boolean)),
      );

      if (eventIds.length === 0) {
        setEvents([]);
        return;
      }

      const { data: eventRows, error: eventsError } = await supabase
        .from("events_active")
        .select(
          "id, type, title, start_date, end_date, date_precision, place_text, description, sort_date, lunar_year, lunar_month, lunar_day, lunar_is_leap_month",
        )
        .in("id", eventIds)
        .order("sort_date", { ascending: false });

      if (eventsError) {
        setError(eventsError.message);
        return;
      }

      setEvents((eventRows ?? []) as EditableTimelineEvent[]);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    loadEvents();
    loadPersons();
  }, [loadEvents, loadPersons]);

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) =>
        String(b.sort_date || b.start_date || "").localeCompare(
          String(a.sort_date || a.start_date || ""),
        ),
      ),
    [events],
  );

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setMessage(null);
    formData.set("person_id", personId);

    startTransition(() => {
      void (async () => {
        const result =
          editing?.mode === "edit"
            ? await updatePersonEvent(formData)
            : await createPersonEvent(formData);

        if (result?.error) {
          setError(result.error);
          return;
        }

        setMessage(
          editing?.mode === "edit"
            ? "Đã cập nhật sự kiện."
            : "Đã thêm sự kiện.",
        );
        setEditing(null);
        await loadEvents();
      })();
    });
  };

  const handleDelete = (event: EditableTimelineEvent) => {
    if (!confirm(`Xóa sự kiện "${event.title || getEventTypeLabel(event.type)}"?`)) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(() => {
      void (async () => {
        const result = await softDeletePersonEvent({ personId, eventId: event.id });

        if (result?.error) {
          setError(result.error);
          return;
        }

        setMessage("Đã xóa sự kiện.");
        await loadEvents();
      })();
    });
  };

  return (
    <div className={className}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-stone-500">
            Quản lý timeline, ngày giỗ, kết hôn, ly hôn và các mốc thời gian của thành viên này.
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMessage(null);
              setEditing({ mode: "create", event: null });
            }}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-amber-700 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-50"
            disabled={isPending}
          >
            <Plus className="size-4" />
            Thêm sự kiện
          </button>
        ) : null}
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
          Đang tải sự kiện...
        </div>
      ) : null}

      {editing ? (
        <EventForm
          key={editing.mode === "edit" ? editing.event.id : "create"}
          editing={editing}
          disabled={isPending}
          persons={persons.filter((person) => person.id !== personId)}
          onCancel={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      {sourceEvent ? (
        <EventSourcesPanel
          eventId={sourceEvent.id}
          eventTitle={sourceEvent.title || getEventTypeLabel(sourceEvent.type)}
          onClose={() => setSourceEvent(null)}
        />
      ) : null}

      {!loading && sortedEvents.length > 0 ? (
        <PersonTimeline
          events={sortedEvents}
          renderActions={
            canEdit
              ? (event) => (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMessage(null);
                        setEditing({ mode: "edit", event: event as EditableTimelineEvent });
                      }}
                      className="rounded-lg p-2 text-stone-400 transition hover:bg-amber-50 hover:text-amber-700"
                      title="Sửa sự kiện"
                    >
                      <Edit3 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(event as EditableTimelineEvent)}
                      className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Xóa sự kiện"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )
              : undefined
          }
        />
      ) : null}

      {!loading && sortedEvents.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
          Chưa có sự kiện nào.
        </div>
      ) : null}
    </div>
  );
}

function parseLunarDeathAnniversaryText(value: string) {
  const raw = value.trim();
  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (day < 1 || day > 30 || month < 1 || month > 12 || year < 1) return null;

  return { day, month, year };
}

function lunarDeathAnniversaryToSolarIso(input: {
  day: number;
  month: number;
  year: number;
  isLeapMonth: boolean;
}) {
  try {
    const lunarMonth = input.isLeapMonth ? -input.month : input.month;
    const solar = Lunar.fromYmd(input.year, lunarMonth, input.day).getSolar();

    return `${String(solar.getYear()).padStart(4, "0")}-${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function getDeathAnniversaryText(event: EditableTimelineEvent | null) {
  if (!event?.lunar_day || !event.lunar_month || !event.lunar_year) return "";

  return `${String(event.lunar_day).padStart(2, "0")}/${String(event.lunar_month).padStart(2, "0")}/${event.lunar_year}`;
}

function EventForm({
  editing,
  disabled,
  persons,
  onCancel,
  onSubmit,
}: {
  editing: EditingState;
  disabled: boolean;
  persons: Person[];
  onCancel: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const event = editing.mode === "edit" ? editing.event : null;
  const [precision, setPrecision] = useState(event?.date_precision || "day");
  const [eventType, setEventType] = useState(event?.type || "custom");
  const [spousePersonId, setSpousePersonId] = useState<string | null>(null);
  const [deathAnniversaryText, setDeathAnniversaryText] = useState(() =>
    event?.type === "death_anniversary" ? getDeathAnniversaryText(event) : "",
  );
  const [deathAnniversaryLeapMonth, setDeathAnniversaryLeapMonth] = useState(
    Boolean(event?.lunar_is_leap_month),
  );
  const precisionInfo = PRECISIONS.find((item) => item.value === precision) ?? PRECISIONS[0];
  const showSpouseSelector = editing.mode === "create" && eventType === "marriage";
  const isDeathAnniversary = eventType === "death_anniversary";

  const handleFormAction = (formData: FormData) => {
    if (isDeathAnniversary) {
      const parsed = parseLunarDeathAnniversaryText(deathAnniversaryText);
      if (!parsed) {
        window.alert("Ngày giỗ âm lịch phải có dạng dd/mm/yyyy, ví dụ 11/03/1971.");
        return;
      }

      const iso = lunarDeathAnniversaryToSolarIso({
        ...parsed,
        isLeapMonth: deathAnniversaryLeapMonth,
      });

      if (!iso) {
        window.alert("Không chuyển đổi được ngày giỗ âm lịch sang dương lịch. Vui lòng kiểm tra lại.");
        return;
      }

      formData.set("type", "death_anniversary");
      formData.set("title", "Ngày giỗ");
      formData.set("description", "Ngày giỗ");
      formData.set("date_precision", "day");
      formData.set("date_text", iso);
      formData.set("lunar_year", String(parsed.year));
      formData.set("lunar_month", String(parsed.month));
      formData.set("lunar_day", String(parsed.day));
      formData.set("lunar_is_leap_month", deathAnniversaryLeapMonth ? "true" : "false");
    }

    onSubmit(formData);
  };

  return (
    <form
      action={handleFormAction}
      className="mb-5 rounded-2xl border border-amber-200/70 bg-white p-4 shadow-sm ring-1 ring-amber-50"
    >
      {event ? <input type="hidden" name="event_id" value={event.id} /> : null}
      {showSpouseSelector && spousePersonId ? (
        <input type="hidden" name="spouse_person_id" value={spousePersonId} />
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-amber-100 p-2 text-amber-700">
            <CalendarDays className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-stone-800">
              {editing.mode === "edit" ? "Sửa sự kiện" : "Thêm sự kiện"}
            </h3>
            <p className="text-xs text-stone-500">
              Ngày dương lịch chọn bằng lịch hoặc nhập dạng dd/mm/yyyy, mm/yyyy hoặc yyyy.
            </p>
          </div>
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
        <label className="block text-sm font-medium text-stone-700">
          Loại sự kiện
          <select
            name="type"
            value={eventType}
            onChange={(event) => {
              const nextType = event.target.value;
              setEventType(nextType);
              if (nextType === "death_anniversary") setPrecision("day");
            }}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {EVENT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {!isDeathAnniversary ? (
        <label className="block text-sm font-medium text-stone-700">
          Độ chính xác ngày
          <select
            name="date_precision"
            value={precision}
            onChange={(event) => setPrecision(event.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {PRECISIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        ) : null}

        {showSpouseSelector ? (
          <div className="sm:col-span-2">
            <PersonSelector
              persons={persons}
              selectedId={spousePersonId}
              onSelect={setSpousePersonId}
              label="Kết hôn với"
              placeholder="Chọn vợ/chồng"
              className="w-full"
            />
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Khi lưu, sự kiện kết hôn sẽ được ghi vào timeline của cả hai người. Nếu hai người đã có family trong Family Model, event sẽ tự gắn với family đó.
            </p>
          </div>
        ) : null}

        {!isDeathAnniversary ? (
        <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
          Tiêu đề
          <input
            name="title"
            defaultValue={event?.title ?? ""}
            placeholder="Ví dụ: Lễ cưới, Nhập học..."
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>
        ) : (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 sm:col-span-2">
            <label className="block text-sm font-semibold text-amber-900">
              Ngày giỗ
              <input
                type="text"
                value={deathAnniversaryText}
                onChange={(event) => setDeathAnniversaryText(event.target.value)}
                placeholder="dd/mm/yyyy âm lịch, ví dụ 11/03/1971"
                className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-900/80">
              <input
                type="checkbox"
                checked={deathAnniversaryLeapMonth}
                onChange={(event) => setDeathAnniversaryLeapMonth(event.target.checked)}
                className="size-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              Tháng âm nhuận
            </label>
            <p className="mt-2 text-xs leading-5 text-amber-800/70">
              Ngày giỗ được lưu thành event riêng, lịch âm, và dùng để nhắc hằng năm. Ngày mất không dùng để nhắc sự kiện.
            </p>
          </div>
        )}

        {!isDeathAnniversary ? (
        <label className="block text-sm font-medium text-stone-700">
          Ngày dương lịch
          <input
            name="date_text"
            type={precision === "day" ? "date" : precision === "month" ? "month" : "text"}
            inputMode="numeric"
            defaultValue={getEventDateInputValue(event)}
            disabled={precision === "unknown"}
            placeholder={precisionInfo.placeholder}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-stone-100 disabled:text-stone-400"
          />
        </label>
        ) : null}

        <label className="block text-sm font-medium text-stone-700">
          Địa điểm
          <input
            name="place_text"
            defaultValue={event?.place_text ?? ""}
            placeholder="Nơi diễn ra nếu có"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>

        {!isDeathAnniversary ? (
        <>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <label className="block text-sm font-medium text-stone-700">
            Năm âm
            <input
              name="lunar_year"
              type="number"
              min="1"
              defaultValue={event?.lunar_year ?? ""}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Tháng âm
            <input
              name="lunar_month"
              type="number"
              min="1"
              max="12"
              defaultValue={event?.lunar_month ?? ""}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Ngày âm
            <input
              name="lunar_day"
              type="number"
              min="1"
              max="30"
              defaultValue={event?.lunar_day ?? ""}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
          <input
            type="checkbox"
            name="lunar_is_leap_month"
            value="true"
            defaultChecked={!!event?.lunar_is_leap_month}
            className="size-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
          />
          Tháng âm nhuận
        </label>
        </>
        ) : null}

        <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
          Ghi chú
          <textarea
            name="description"
            rows={3}
            defaultValue={event?.description ?? ""}
            placeholder="Ghi chú thêm về sự kiện"
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

function formatIsoDateForInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function formatIsoMonthForInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return value;
  return `${match[1]}-${match[2]}`;
}

function getEventTypeLabel(type: string) {
  return EVENT_TYPES.find((item) => item.value === type)?.label ?? type;
}

function getEventDateInputValue(event: EditableTimelineEvent | null) {
  if (!event?.start_date) return "";
  if (event.date_precision === "year") return event.start_date.slice(0, 4);
  if (event.date_precision === "month") return formatIsoMonthForInput(event.start_date);
  return formatIsoDateForInput(event.start_date);
}
