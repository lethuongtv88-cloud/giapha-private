export type SupabaseLike = {
  from: (table: string) => any;
};

export async function getPersonTimelineEvents(
  supabase: SupabaseLike,
  personId: string,
) {
  const { data: personEvents, error: personEventsError } = await supabase
    .from('person_events')
    .select('event_id')
    .eq('person_id', personId);

  if (personEventsError) {
    console.warn('Failed to load person timeline links:', personEventsError);
    return [];
  }

  const eventIds = Array.from(
    new Set((personEvents ?? []).map((row: any) => row.event_id).filter(Boolean)),
  );

  if (eventIds.length === 0) {
    return [];
  }

  const { data: events, error: eventsError } = await supabase
    .from('events_active')
    .select('id, type, title, start_date, end_date, date_precision, place_text, description, sort_date')
    .in('id', eventIds)
    .order('sort_date', { ascending: true });

  if (eventsError) {
    console.warn('Failed to load person timeline events:', eventsError);
    return [];
  }

  return events ?? [];
}
