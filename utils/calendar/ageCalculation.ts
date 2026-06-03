export type AgePrecision = 'exact' | 'year_only' | 'partial' | 'unknown';

export interface AgeEvent {
  start_date: string | null;
  end_date: string | null;
  date_precision: string;
}

export interface AgeResult {
  minAge: number | null;
  maxAge: number | null;
  precision: AgePrecision;
  display: string;
  displayShort: string;
}

export function calculateAgeFromEvents(
  birthEvent: AgeEvent | null,
  deathEvent: AgeEvent | null,
): AgeResult {
  const unknown: AgeResult = {
    minAge: null,
    maxAge: null,
    precision: 'unknown',
    display: '',
    displayShort: '',
  };

  if (!birthEvent?.start_date) return unknown;

  const birthStart = parseDateOnly(birthEvent.start_date);
  const birthEnd = birthEvent.end_date
    ? parseDateOnly(birthEvent.end_date)
    : birthStart;

  const now = todayDateOnly();

  const refStart = deathEvent?.start_date
    ? parseDateOnly(deathEvent.start_date)
    : now;

  const refEnd = deathEvent?.end_date
    ? parseDateOnly(deathEvent.end_date)
    : refStart;

  const birthExact = birthEvent.date_precision === 'day';
  const deathExact = !deathEvent || deathEvent.date_precision === 'day';

  const birthIsYear = ['year', 'decade', 'unknown'].includes(
    birthEvent.date_precision,
  );

  const deathIsYear = deathEvent
    ? ['year', 'decade', 'unknown'].includes(deathEvent.date_precision)
    : false;

  if (birthExact && deathExact) {
    const age = calcAge(birthStart, refStart);

    return {
      minAge: age,
      maxAge: age,
      precision: 'exact',
      display: `${age} tuổi`,
      displayShort: `${age} tuổi`,
    };
  }

  if (birthIsYear || deathIsYear) {
    const min = calcAge(birthEnd, refStart);
    const max = calcAge(birthStart, refEnd);

    return {
      minAge: min,
      maxAge: max,
      precision: 'year_only',
      display: min === max ? `khoảng ${min} tuổi` : `khoảng ${min}–${max} tuổi`,
      displayShort: min === max ? `~${min} tuổi` : `~${min}–${max} tuổi`,
    };
  }

  const min = calcAge(birthEnd, refStart);
  const max = calcAge(birthStart, refEnd);
  const mid = Math.round((min + max) / 2);

  return {
    minAge: min,
    maxAge: max,
    precision: 'partial',
    display: min === max ? `khoảng ${min} tuổi` : `khoảng ${min}–${max} tuổi`,
    displayShort: `~${mid} tuổi`,
  };
}

export function formatLifespan(
  birthEvent: AgeEvent | null,
  deathEvent: AgeEvent | null,
  isLiving: boolean,
): string {
  if (!birthEvent?.start_date) return '';

  const bYear = parseDateOnly(birthEvent.start_date).getUTCFullYear();
  const bApprox = birthEvent.date_precision !== 'day' ? '~' : '';

  if (isLiving) {
    const age = calculateAgeFromEvents(birthEvent, null);
    const ageStr = age.precision !== 'unknown' ? ` (${age.displayShort})` : '';
    return `${bApprox}${bYear} – nay${ageStr}`;
  }

  if (!deathEvent?.start_date) {
    return `${bApprox}${bYear} – ?`;
  }

  const dYear = parseDateOnly(deathEvent.start_date).getUTCFullYear();
  const dApprox = deathEvent.date_precision !== 'day' ? '~' : '';

  const age = calculateAgeFromEvents(birthEvent, deathEvent);
  const ageStr = age.precision !== 'unknown' ? ` (${age.displayShort})` : '';

  return `${bApprox}${bYear} – ${dApprox}${dYear}${ageStr}`;
}

function calcAge(birthDate: Date, refDate: Date): number {
  let age = refDate.getUTCFullYear() - birthDate.getUTCFullYear();

  const monthDiff = refDate.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = refDate.getUTCDate() - birthDate.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return Math.max(0, age);
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    throw new Error(`Invalid date: ${value}`);
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function todayDateOnly(): Date {
  const now = new Date();

  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
}
