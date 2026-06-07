import { GenealogyDateDisplay } from '@/components/GenealogyDateDisplay';
import type { AgeEvent } from '@/utils/calendar/ageCalculation';
import { CalendarDays, MapPin } from 'lucide-react';

export type TimelineEvent = {
  id: string;
  type: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  date_precision: string | null;
  place_text?: string | null;
  description?: string | null;
  sort_date?: string | null;
};

type PersonTimelineProps = {
  events: TimelineEvent[];
  className?: string;
};

export function PersonTimeline({ events, className }: PersonTimelineProps) {
  const visibleEvents = events
    .filter((event) => event.start_date || event.sort_date)
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

  return (
    <div className={className}>
      <div className="space-y-3">
        {visibleEvents.map((event) => {
          const ageEvent: AgeEvent = {
            start_date: event.start_date,
            end_date: event.end_date,
            date_precision: event.date_precision ?? 'unknown',
          };
          const label = event.title || getEventTypeLabel(event.type);
          const style = getEventTypeStyle(event.type);

          return (
            <div
              key={event.id}
              className="group rounded-2xl border border-stone-200/60 bg-white/80 p-4 shadow-sm transition-all hover:border-amber-200/70 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border ${style.iconWrap}`}
                >
                  <CalendarDays className={`size-4 ${style.icon}`} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <h4 className="text-sm font-bold text-stone-800">{label}</h4>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
                      {getEventTypeLabel(event.type)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-stone-500">
                    <span>
                      <GenealogyDateDisplay event={ageEvent} />
                    </span>
                    {event.place_text ? (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <span className="text-stone-300">·</span>
                        <MapPin className="size-3.5 shrink-0 text-stone-400" />
                        <span className="truncate">{event.place_text}</span>
                      </span>
                    ) : null}
                  </div>

                  {event.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">
                      {event.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getEventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    birth: 'Sinh',
    death: 'Mất',
    marriage: 'Kết hôn',
    divorce: 'Ly hôn',
    burial: 'An táng',
    residence: 'Cư trú',
    occupation: 'Nghề nghiệp',
    migration: 'Di cư',
    military: 'Quân ngũ',
    custom: 'Sự kiện',
  };

  return labels[type] ?? type;
}


function getEventSortValue(event: TimelineEvent) {
  return String(event.sort_date || event.start_date || '');
}

function getEventTypeStyle(type: string) {
  const styles: Record<string, { iconWrap: string; icon: string; badge: string }> = {
    birth: {
      iconWrap: 'border-emerald-100 bg-emerald-50 text-emerald-600',
      icon: 'text-emerald-600',
      badge: 'bg-emerald-50 text-emerald-700',
    },
    death: {
      iconWrap: 'border-stone-200 bg-stone-100 text-stone-600',
      icon: 'text-stone-600',
      badge: 'bg-stone-100 text-stone-700',
    },
    marriage: {
      iconWrap: 'border-rose-100 bg-rose-50 text-rose-600',
      icon: 'text-rose-600',
      badge: 'bg-rose-50 text-rose-700',
    },
    divorce: {
      iconWrap: 'border-orange-100 bg-orange-50 text-orange-600',
      icon: 'text-orange-600',
      badge: 'bg-orange-50 text-orange-700',
    },
    burial: {
      iconWrap: 'border-purple-100 bg-purple-50 text-purple-600',
      icon: 'text-purple-600',
      badge: 'bg-purple-50 text-purple-700',
    },
  };

  return (
    styles[type] ?? {
      iconWrap: 'border-amber-100 bg-amber-50 text-amber-600',
      icon: 'text-amber-600',
      badge: 'bg-amber-50 text-amber-700',
    }
  );
}
