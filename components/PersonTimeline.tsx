import type React from "react";
import { CalendarDays, MapPin, Moon } from "lucide-react";
import PlaceMapLinks, {
  type PlaceForMapLinks,
} from "@/components/places/PlaceMapLinks";

export type TimelineEvent = {
  id: string;
  type: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  date_precision: string | null;
  place_text?: string | null;
  place_id?: string | null;
  place?: PlaceForMapLinks | null;
  description?: string | null;
  sort_date?: string | null;
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_is_leap_month?: boolean | null;
};

type PersonTimelineProps = {
  events: TimelineEvent[];
  className?: string;
  renderActions?: (event: TimelineEvent) => React.ReactNode;
};

export function PersonTimeline({
  events,
  className,
  renderActions,
}: PersonTimelineProps) {
  const visibleEvents = events
    .filter(
      (event) =>
        event.start_date || event.sort_date || event.date_precision === "unknown",
    )
    .sort((a, b) => getEventSortValue(b).localeCompare(getEventSortValue(a)));

  if (visibleEvents.length === 0) {
    return (
      <div className={className}>
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 px-4 py-5 text-center">
          <p className="text-sm font-medium text-stone-400">Chưa có sự kiện.</p>
        </div>
      </div>
    );
  }

  const grouped = groupEventsByYear(visibleEvents);

  return (
    <div className={className}>
      <div className="space-y-6">
        {grouped.map((group) => (
          <section key={group.year} className="relative">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-stone-200" />
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-bold text-stone-600 shadow-sm">
                {group.year}
              </span>
              <div className="h-px flex-1 bg-stone-200" />
            </div>

            <div className="space-y-3">
              {group.events.map((event) => {
                const label = event.title || getEventTypeLabel(event.type);
                const style = getEventTypeStyle(event.type);
                const lunarLabel = formatLunarDate(event);

                return (
                  <div
                    key={event.id}
                    className="group rounded-2xl border border-stone-200/60 bg-white/85 p-4 shadow-sm transition-all hover:border-amber-200/70 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border ${style.iconWrap}`}
                      >
                        <CalendarDays className={`size-4 ${style.icon}`} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-stone-800">
                              {label}
                            </h4>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-stone-500">
                              <span>{formatEventDate(event)}</span>

                              {lunarLabel ? (
                                <span className="inline-flex items-center gap-1 text-amber-700">
                                  <span className="text-stone-300">·</span>
                                  <Moon className="size-3.5" />
                                  <span>ÂL: {lunarLabel}</span>
                                </span>
                              ) : null}

                              {event.place ? (
                                <span className="inline-flex min-w-0 items-center gap-1">
                                  <span className="text-stone-300">·</span>
                                  <MapPin className="size-3.5 shrink-0 text-stone-400" />
                                  <span className="truncate">
                                    {event.place.name}
                                  </span>
                                </span>
                              ) : event.place_text ? (
                                <span className="inline-flex min-w-0 items-center gap-1">
                                  <span className="text-stone-300">·</span>
                                  <MapPin className="size-3.5 shrink-0 text-stone-400" />
                                  <span className="truncate">
                                    {event.place_text}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}
                            >
                              {getEventTypeLabel(event.type)}
                            </span>
                            {renderActions ? renderActions(event) : null}
                          </div>
                        </div>

                        {event.description ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">
                            {event.description}
                          </p>
                        ) : null}

                        {event.place ? (
                          <div className="mt-3">
                            <PlaceMapLinks place={event.place} compact={false} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupEventsByYear(events: TimelineEvent[]) {
  const groups = new Map<string, TimelineEvent[]>();

  for (const event of events) {
    const key = getEventYearLabel(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return Array.from(groups.entries()).map(([year, groupEvents]) => ({
    year,
    events: groupEvents,
  }));
}

function getEventYearLabel(event: TimelineEvent) {
  const value = event.sort_date || event.start_date;
  if (!value) return "Chưa rõ năm";
  return value.slice(0, 4);
}

function getEventSortValue(event: TimelineEvent) {
  return String(event.sort_date || event.start_date || "0000-00-00");
}

export function getEventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    birth: "Sinh",
    death: "Mất",
    death_anniversary: "Ngày giỗ",
    marriage: "Kết hôn",
    wedding: "Đám cưới",
    divorce: "Ly hôn",
    burial: "An táng",
    residence: "Cư trú",
    occupation: "Nghề nghiệp",
    migration: "Di cư",
    military: "Quân ngũ",
    custom: "Sự kiện",
  };

  return labels[type] ?? type;
}

function formatEventDate(event: TimelineEvent) {
  if (!event.start_date) {
    return event.date_precision === "unknown" ? "Chưa rõ ngày" : "Không có ngày";
  }

  if (event.date_precision === "year") return event.start_date.slice(0, 4);
  if (event.date_precision === "month") return formatIsoMonth(event.start_date);

  if (
    event.date_precision === "range" &&
    event.end_date &&
    event.end_date !== event.start_date
  ) {
    return `${formatIsoDate(event.start_date)} – ${formatIsoDate(event.end_date)}`;
  }

  return formatIsoDate(event.start_date);
}

function formatIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatIsoMonth(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return value;
  return `${match[2]}-${match[1]}`;
}

function formatLunarDate(event: TimelineEvent) {
  if (!event.lunar_year && !event.lunar_month && !event.lunar_day) return null;

  const day = event.lunar_day ? String(event.lunar_day).padStart(2, "0") : "??";
  const month = event.lunar_month
    ? String(event.lunar_month).padStart(2, "0")
    : "??";
  const year = event.lunar_year ? String(event.lunar_year) : "????";
  const leap = event.lunar_is_leap_month ? " nhuận" : "";

  return `${day}-${month}${leap}-${year}`;
}

function getEventTypeStyle(type: string) {
  const styles: Record<
    string,
    { iconWrap: string; icon: string; badge: string }
  > = {
    birth: {
      iconWrap: "border-emerald-100 bg-emerald-50 text-emerald-600",
      icon: "text-emerald-600",
      badge: "bg-emerald-50 text-emerald-700",
    },
    death: {
      iconWrap: "border-stone-200 bg-stone-100 text-stone-600",
      icon: "text-stone-600",
      badge: "bg-stone-100 text-stone-700",
    },
    death_anniversary: {
      iconWrap: "border-amber-100 bg-amber-50 text-amber-700",
      icon: "text-amber-700",
      badge: "bg-amber-50 text-amber-700",
    },
    marriage: {
      iconWrap: "border-rose-100 bg-rose-50 text-rose-600",
      icon: "text-rose-600",
      badge: "bg-rose-50 text-rose-700",
    },
    wedding: {
      iconWrap: "border-pink-100 bg-pink-50 text-pink-600",
      icon: "text-pink-600",
      badge: "bg-pink-50 text-pink-700",
    },
    divorce: {
      iconWrap: "border-orange-100 bg-orange-50 text-orange-600",
      icon: "text-orange-600",
      badge: "bg-orange-50 text-orange-700",
    },
    burial: {
      iconWrap: "border-purple-100 bg-purple-50 text-purple-600",
      icon: "text-purple-600",
      badge: "bg-purple-50 text-purple-700",
    },
  };

  return (
    styles[type] ?? {
      iconWrap: "border-amber-100 bg-amber-50 text-amber-600",
      icon: "text-amber-600",
      badge: "bg-amber-50 text-amber-700",
    }
  );
}
