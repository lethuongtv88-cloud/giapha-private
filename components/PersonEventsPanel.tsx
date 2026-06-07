"use client";

import {
  createPersonEvent,
  softDeletePersonEvent,
  updatePersonEvent,
} from "@/app/actions/events";
import { PersonTimeline, type TimelineEvent } from "@/components/PersonTimeline";
import { createClient } from "@/utils/supabase/client";
import { CalendarDays, Edit3, Plus, Trash2, X } from "lucide-react";
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
  { value: "marriage", label: "Kết hôn" },
  { value: "divorce", label: "Ly hôn" },
  { value: "burial", label: "An táng" },
  { value: "residence", label: "Cư trú" },
  { value: "occupation", label: "Nghề nghiệp" },
  { value: "migration", label: "Di cư" },
  { value: "military", label: "Quân ngũ" },
  { value: "custom", label: "Giỗ / ngày kỵ / Khác" },
];

const PRECISIONS = [
  { value: "day", label: "Chính xác ngày", placeholder: "YYYY-MM-DD" },
  { value: "month", label: "Chỉ tháng/năm", placeholder: "YYYY-MM" },
  { value: "year", label: "Chỉ năm", placeholder: "YYYY" },
  { value: "unknown", label: "Không rõ ngày", placeholder: "Để trống" },
];

export default function PersonEventsPanel({
  personId,
  canEdit = false,
  className,
}: PersonEventsPanelProps) {
  const [events, setEvents] = useState<EditableTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
  }, [loadEvents]);

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
            Quản lý các mốc thời gian và sự kiện liên quan đến thành viên này.
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
          onCancel={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      {canEdit && sortedEvents.length > 0 ? (
        <div className="mb-5 space-y-2">
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-stone-200/70 bg-stone-50/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-800">
                  {event.title || getEventTypeLabel(event.type)}
                </p>
                <p className="text-xs text-stone-500">
                  {getEventTypeLabel(event.type)} · {formatEventDateSummary(event)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMessage(null);
                    setEditing({ mode: "edit", event });
                  }}
                  className="rounded-lg p-2 text-stone-400 transition hover:bg-amber-50 hover:text-amber-700"
                  title="Sửa sự kiện"
                >
                  <Edit3 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(event)}
                  className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                  title="Xóa sự kiện"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <PersonTimeline events={sortedEvents} />
    </div>
  );
}

function EventForm({
  editing,
  disabled,
  onCancel,
  onSubmit,
}: {
  editing: EditingState;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const event = editing.mode === "edit" ? editing.event : null;
  const [precision, setPrecision] = useState(event?.date_precision || "day");
  const precisionInfo = PRECISIONS.find((item) => item.value === precision) ?? PRECISIONS[0];

  return (
    <form
      action={onSubmit}
      className="mb-5 rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4 shadow-sm"
    >
      {event ? <input type="hidden" name="event_id" value={event.id} /> : null}

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
              Ngày có thể nhập theo ngày, tháng/năm hoặc chỉ năm.
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
            defaultValue={event?.type || "custom"}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {EVENT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

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

        <label className="block text-sm font-medium text-stone-700 sm:col-span-2">
          Tiêu đề
          <input
            name="title"
            defaultValue={event?.title ?? ""}
            placeholder="Ví dụ: Lễ cưới, Ngày giỗ, Nhập học..."
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Ngày dương lịch
          <input
            name="date_text"
            defaultValue={getEventDateInputValue(event)}
            disabled={precision === "unknown"}
            placeholder={precisionInfo.placeholder}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-stone-100 disabled:text-stone-400"
          />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Địa điểm
          <input
            name="place_text"
            defaultValue={event?.place_text ?? ""}
            placeholder="Nơi diễn ra nếu có"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </label>

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

function getEventTypeLabel(type: string) {
  return EVENT_TYPES.find((item) => item.value === type)?.label ?? type;
}

function getEventDateInputValue(event: EditableTimelineEvent | null) {
  if (!event?.start_date) return "";
  if (event.date_precision === "year") return event.start_date.slice(0, 4);
  if (event.date_precision === "month") return event.start_date.slice(0, 7);
  return event.start_date.slice(0, 10);
}

function formatEventDateSummary(event: EditableTimelineEvent) {
  if (!event.start_date) return "Chưa rõ ngày";
  if (event.date_precision === "year") return event.start_date.slice(0, 4);
  if (event.date_precision === "month") return event.start_date.slice(0, 7);
  return event.start_date.slice(0, 10);
}
