import {
  getBirthEventFromLegacy,
  getDeathEventFromLegacy,
  type LegacyDatePerson,
} from '@/compat/date.compat';
import { formatLifespan, type AgeEvent } from '@/utils/calendar/ageCalculation';

export type PersonWithOptionalDateEvents = LegacyDatePerson & {
  birthEvent?: AgeEvent | null;
  deathEvent?: AgeEvent | null;
};

export function formatPersonLifespanFromLegacy(person: LegacyDatePerson) {
  const birthEvent = getBirthEventFromLegacy(person);
  const deathEvent = getDeathEventFromLegacy(person);

  return formatLifespan(
    birthEvent,
    deathEvent,
    person.is_deceased !== true,
  );
}

export function formatPersonLifespan(person: PersonWithOptionalDateEvents) {
  const birthEvent = person.birthEvent ?? getBirthEventFromLegacy(person);
  const deathEvent = person.deathEvent ?? getDeathEventFromLegacy(person);

  return formatLifespan(
    birthEvent,
    deathEvent,
    person.is_deceased !== true,
  );
}