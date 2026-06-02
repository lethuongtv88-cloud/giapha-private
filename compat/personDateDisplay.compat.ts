import {
  getBirthEventFromLegacy,
  getDeathEventFromLegacy,
  type LegacyDatePerson,
} from '@/compat/date.compat';
import { formatLifespan } from '@/utils/calendar/ageCalculation';

export function formatPersonLifespanFromLegacy(person: LegacyDatePerson) {
  const birthEvent = getBirthEventFromLegacy(person);
  const deathEvent = getDeathEventFromLegacy(person);

  return formatLifespan(
    birthEvent,
    deathEvent,
    person.is_deceased !== true,
  );
}
