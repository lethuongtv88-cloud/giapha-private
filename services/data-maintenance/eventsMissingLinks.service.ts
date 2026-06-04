export type EventMissingLinkLike = {
  id: string;
  type: string;
  legacy_person_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  sort_date?: string | null;
  deleted_at?: string | null;
};

export type PersonEventLike = {
  person_id: string;
  event_id: string;
  role?: string | null;
};

export type PersonLike = {
  id: string;
  full_name?: string | null;
};

export type EventMissingLinkRow = {
  eventId: string;
  personId: string;
  personName: string;
  type: string;
  role: "principal" | "deceased";
  startDate: string | null;
  endDate: string | null;
  sortDate: string | null;
};

export function buildEventsMissingLinksRows(input: {
  events: EventMissingLinkLike[];
  personEvents: PersonEventLike[];
  persons: PersonLike[];
}): EventMissingLinkRow[] {
  const personNameById = new Map(
    input.persons.map((person) => [person.id, person.full_name || person.id]),
  );

  const existingLinks = new Set(
    input.personEvents.map((link) => `${link.person_id}:${link.event_id}`),
  );

  return input.events
    .filter((event) => !event.deleted_at)
    .filter((event) => event.type === "birth" || event.type === "death")
    .filter((event) => Boolean(event.legacy_person_id))
    .filter((event) => {
      return !existingLinks.has(`${event.legacy_person_id}:${event.id}`);
    })
    .map((event) => ({
      eventId: event.id,
      personId: event.legacy_person_id as string,
      personName:
        personNameById.get(event.legacy_person_id as string) ??
        (event.legacy_person_id as string),
      type: event.type,
      role: event.type === "death" ? "deceased" : "principal",
      startDate: event.start_date ?? null,
      endDate: event.end_date ?? null,
      sortDate: event.sort_date ?? null,
    }))
    .sort((a, b) => {
      return a.personName.localeCompare(b.personName) || a.type.localeCompare(b.type);
    });
}
