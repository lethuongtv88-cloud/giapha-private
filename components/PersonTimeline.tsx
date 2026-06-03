import { GenealogyDateDisplay } from '@/components/GenealogyDateDisplay';
import type { AgeEvent } from '@/utils/calendar/ageCalculation';

export type TimelineEvent = {
  id: string;
  type: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  date_precision: string | null;
  place_text?: string | null;
  description?: string | null;
};

type PersonTimelineProps = {
  events: TimelineEvent[];
  className?: string;
};

export function PersonTimeline({ events, className }: PersonTimelineProps) {
  const visibleEvents = events
    .filter((event) => event.start_date)
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

  if (visibleEvents.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground">Chưa có mốc thời gian.</p>
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

          return (
            <div
              key={event.id}
              className="border-l-2 pl-3"
            >
              <div className="text-sm font-medium">
                {event.title || getEventTypeLabel(event.type)}
              </div>

              <div className="text-xs text-muted-foreground">
                <GenealogyDateDisplay event={ageEvent} />
                {event.place_text ? ` · ${event.place_text}` : ''}
              </div>

              {event.description ? (
                <div className="mt-1 text-sm text-muted-foreground">
                  {event.description}
                </div>
              ) : null}
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
