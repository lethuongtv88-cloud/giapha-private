'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { PersonTimeline, type TimelineEvent } from '@/components/PersonTimeline';
import { featureFlags } from '@/lib/featureFlags';

type PersonTimelineClientProps = {
  personId: string;
  className?: string;
};

export function PersonTimelineClient({
  personId,
  className,
}: PersonTimelineClientProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      if (!featureFlags.readEvents || !personId) {
        setEvents([]);
        return;
      }

      setLoading(true);

      try {
        const supabase = createClient();

        const { data: personEvents, error: personEventsError } = await supabase
          .from('person_events')
          .select('event_id')
          .eq('person_id', personId);

        if (personEventsError) {
          console.warn('Failed to load person timeline links:', personEventsError);
          return;
        }

        const eventIds = Array.from(
          new Set((personEvents ?? []).map((row) => row.event_id).filter(Boolean)),
        );

        if (eventIds.length === 0) {
          if (!cancelled) setEvents([]);
          return;
        }

        const { data: eventRows, error: eventsError } = await supabase
          .from('events_active')
          .select('id, type, title, start_date, end_date, date_precision, place_text, description, sort_date')
          .in('id', eventIds)
          .order('sort_date', { ascending: true });

        if (eventsError) {
          console.warn('Failed to load person timeline events:', eventsError);
          return;
        }

        if (!cancelled) {
          setEvents((eventRows ?? []) as TimelineEvent[]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [personId]);

  if (!featureFlags.readEvents) {
    return null;
  }

  if (loading) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground">Đang tải mốc thời gian...</p>
      </div>
    );
  }

  return (
    <PersonTimeline
      events={events}
      className={className}
    />
  );
}
