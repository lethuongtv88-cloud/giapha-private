import { featureFlags } from '@/lib/featureFlags';
import type { AgeEvent } from '@/utils/calendar/ageCalculation';

type SupabaseLike = {
  from: (table: string) => any;
};

type PersonLike = {
  id: string;
};

type EventRow = {
  type: 'birth' | 'death';
  start_date: string | null;
  end_date: string | null;
  date_precision: string | null;
};

type PersonEventJoinRow = {
  person_id: string;
  events: EventRow | EventRow[] | null;
};

export type PersonWithHydratedDates<T> = T & {
  birthEvent?: AgeEvent | null;
  deathEvent?: AgeEvent | null;
};

export async function hydratePersonsWithDateEvents<T extends PersonLike>(
  supabase: SupabaseLike,
  persons: T[],
): Promise<PersonWithHydratedDates<T>[]> {
  if (!featureFlags.readEvents) {
    return persons;
  }

  const ids = persons.map((p) => p.id).filter(Boolean);

  if (ids.length === 0) {
    return persons;
  }

  const { data, error } = await supabase
    .from('person_events')
    .select(`
      person_id,
      events:event_id (
        type,
        start_date,
        end_date,
        date_precision
      )
    `)
    .in('person_id', ids);

  if (error) {
    console.warn('Failed to hydrate person date events:', error.message);
    return persons;
  }

  const map = new Map<string, { birthEvent: AgeEvent | null; deathEvent: AgeEvent | null }>();

  for (const row of (data ?? []) as PersonEventJoinRow[]) {
    const event = normalizeJoinedEvent(row.events);
    if (!event?.start_date) continue;

    const current = map.get(row.person_id) ?? {
      birthEvent: null,
      deathEvent: null,
    };

    const ageEvent: AgeEvent = {
      start_date: event.start_date,
      end_date: event.end_date,
      date_precision: event.date_precision ?? 'unknown',
    };

    if (event.type === 'birth' && !current.birthEvent) {
      current.birthEvent = ageEvent;
    }

    if (event.type === 'death' && !current.deathEvent) {
      current.deathEvent = ageEvent;
    }

    map.set(row.person_id, current);
  }

  return persons.map((person) => {
    const hydrated = map.get(person.id);

    if (!hydrated) {
      return {
        ...person,
        birthEvent: null,
        deathEvent: null,
      };
    }

    return {
      ...person,
      birthEvent: hydrated.birthEvent,
      deathEvent: hydrated.deathEvent,
    };
  });
}

function normalizeJoinedEvent(value: EventRow | EventRow[] | null): EventRow | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}
