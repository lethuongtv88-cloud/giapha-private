export type EventLike = {
  id: string;
  type: string;
  legacy_person_id?: string | null;
  start_date?: string | null;
  sort_date?: string | null;
  deleted_at?: string | null;
};

export type PersonLike = {
  id: string;
  full_name?: string | null;
};

export type DuplicateEventGroup = {
  personId: string;
  personName: string;
  type: string;
  startDate: string | null;
  sortDate: string | null;
  count: number;
  eventIds: string[];
};

export function buildDuplicateEventGroups(input: {
  events: EventLike[];
  persons: PersonLike[];
}): DuplicateEventGroup[] {
  const personNameById = new Map(
    input.persons.map((person) => [person.id, person.full_name || person.id]),
  );

  const groups = new Map<string, DuplicateEventGroup>();

  for (const event of input.events) {
    if (event.deleted_at) continue;
    if (!event.legacy_person_id) continue;
    if (event.type !== "birth" && event.type !== "death") continue;

    const key = [
      event.legacy_person_id,
      event.type,
      event.start_date ?? "",
      event.sort_date ?? "",
    ].join("|");

    const group = groups.get(key) ?? {
      personId: event.legacy_person_id,
      personName: personNameById.get(event.legacy_person_id) ?? event.legacy_person_id,
      type: event.type,
      startDate: event.start_date ?? null,
      sortDate: event.sort_date ?? null,
      count: 0,
      eventIds: [],
    };

    group.count += 1;
    group.eventIds.push(event.id);

    groups.set(key, group);
  }

  return Array.from(groups.values())
    .filter((group) => group.count > 1)
    .sort((a, b) => b.count - a.count || a.personName.localeCompare(b.personName));
}
