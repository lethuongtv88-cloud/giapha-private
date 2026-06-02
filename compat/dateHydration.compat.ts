import { featureFlags } from '@/lib/featureFlags';
import type { AgeEvent } from '@/utils/calendar/ageCalculation';

const BATCH_SIZE = 80;

type SupabaseLike = {
  from: (table: string) => any;
};

type PersonLike = {
  id: string;
};

type EventRow = {
  id: string;
  type: 'birth' | 'death';
  start_date: string | null;
  end_date: string | null;
  date_precision: string | null;
};

type PersonEventRow = {
  person_id: string;
  event_id: string;
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

  try {
    const ids = persons.map((p) => p.id).filter(Boolean);

    if (ids.length === 0) {
      return persons;
    }

    const personEvents = await loadPersonEventsInBatches(supabase, ids);
    const eventIds = Array.from(
      new Set(personEvents.map((row) => row.event_id).filter(Boolean)),
    );

    if (eventIds.length === 0) {
      return persons.map((person) => ({
        ...person,
        birthEvent: null,
        deathEvent: null,
      }));
    }

    const events = await loadEventsInBatches(supabase, eventIds);
    const eventsById = new Map<string, EventRow>();

    for (const event of events) {
      eventsById.set(event.id, event);
    }

    const dateMap = new Map<
      string,
      { birthEvent: AgeEvent | null; deathEvent: AgeEvent | null }
    >();

    for (const row of personEvents) {
      const event = eventsById.get(row.event_id);
      if (!event?.start_date) continue;

      const current = dateMap.get(row.person_id) ?? {
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

      dateMap.set(row.person_id, current);
    }

    return persons.map((person) => {
      const hydrated = dateMap.get(person.id);

      return {
        ...person,
        birthEvent: hydrated?.birthEvent ?? null,
        deathEvent: hydrated?.deathEvent ?? null,
      };
    });
  } catch (error) {
    console.warn('Failed to hydrate person date events:', error);
    return persons;
  }
}

async function loadPersonEventsInBatches(
  supabase: SupabaseLike,
  personIds: string[],
): Promise<PersonEventRow[]> {
  const rows: PersonEventRow[] = [];

  for (const batch of chunk(personIds, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('person_events')
      .select('person_id, event_id')
      .in('person_id', batch);

    if (error) {
      console.warn('Failed to load person_events for date hydration:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      continue;
    }

    rows.push(...((data ?? []) as PersonEventRow[]));
  }

  return rows;
}

async function loadEventsInBatches(
  supabase: SupabaseLike,
  eventIds: string[],
): Promise<EventRow[]> {
  const rows: EventRow[] = [];

  for (const batch of chunk(eventIds, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('events_active')
      .select('id, type, start_date, end_date, date_precision')
      .in('id', batch)
      .in('type', ['birth', 'death']);

    if (error) {
      console.warn('Failed to load events for date hydration:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      continue;
    }

    rows.push(...((data ?? []) as EventRow[]));
  }

  return rows;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }

  return out;
}
