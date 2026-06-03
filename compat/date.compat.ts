import { featureFlags } from '@/lib/featureFlags';
import { buildDateRange } from '@/utils/date-parser/normalizeDate';
import type { AgeEvent } from '@/utils/calendar/ageCalculation';

export type LegacyDatePerson = {
  id: string;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  death_year?: number | null;
  death_month?: number | null;
  death_day?: number | null;
  is_deceased?: boolean | null;
};

export type PersonDateEvents = {
  birthEvent: AgeEvent | null;
  deathEvent: AgeEvent | null;
};

type SupabaseLike = {
  from: (table: string) => any;
};

type EventRow = {
  type: 'birth' | 'death';
  start_date: string | null;
  end_date: string | null;
  date_precision: string | null;
};

export async function getPersonDateEvents(
  supabase: SupabaseLike,
  person: LegacyDatePerson,
): Promise<PersonDateEvents> {
  if (featureFlags.readEvents) {
    const fromEvents = await getDateEventsFromEventModel(supabase, person.id);

    return {
      birthEvent: fromEvents.birthEvent ?? getBirthEventFromLegacy(person),
      deathEvent: fromEvents.deathEvent ?? getDeathEventFromLegacy(person),
    };
  }

  return {
    birthEvent: getBirthEventFromLegacy(person),
    deathEvent: getDeathEventFromLegacy(person),
  };
}

export function getBirthEventFromLegacy(person: LegacyDatePerson): AgeEvent | null {
  if (!person.birth_year) return null;

  const range = buildDateRange(
    person.birth_year,
    person.birth_month,
    person.birth_day,
  );

  return {
    start_date: range.start_date,
    end_date: range.end_date,
    date_precision: range.date_precision,
  };
}

export function getDeathEventFromLegacy(person: LegacyDatePerson): AgeEvent | null {
  if (person.is_deceased !== true) return null;
  if (!person.death_year) return null;

  const range = buildDateRange(
    person.death_year,
    person.death_month,
    person.death_day,
  );

  return {
    start_date: range.start_date,
    end_date: range.end_date,
    date_precision: range.date_precision,
  };
}

async function getDateEventsFromEventModel(
  supabase: SupabaseLike,
  personId: string,
): Promise<PersonDateEvents> {
  const { data, error } = await supabase
    .from('person_events')
    .select(`
      events:event_id (
        type,
        start_date,
        end_date,
        date_precision
      )
    `)
    .eq('person_id', personId);

  if (error) {
    console.warn(`Failed to load event dates for person ${personId}:`, error.message);
    return { birthEvent: null, deathEvent: null };
  }

  let birthEvent: AgeEvent | null = null;
  let deathEvent: AgeEvent | null = null;

  for (const row of data ?? []) {
    const event = normalizeJoinedEvent(row.events);
    if (!event?.start_date) continue;

    const ageEvent: AgeEvent = {
      start_date: event.start_date,
      end_date: event.end_date,
      date_precision: event.date_precision ?? 'unknown',
    };

    if (event.type === 'birth' && !birthEvent) {
      birthEvent = ageEvent;
    }

    if (event.type === 'death' && !deathEvent) {
      deathEvent = ageEvent;
    }
  }

  return { birthEvent, deathEvent };
}

function normalizeJoinedEvent(value: unknown): EventRow | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return (value[0] ?? null) as EventRow | null;
  }

  return value as EventRow;
}
