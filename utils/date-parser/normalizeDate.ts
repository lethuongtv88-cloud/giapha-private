export type DatePrecision = 'day' | 'month' | 'year';

export interface NormalizedDateRange {
  start_date: string;
  end_date: string;
  sort_date: string;
  date_precision: DatePrecision;
  date_modifier: 'exact';
  canonical_calendar: 'gregorian';
  date_original_text: string;
}

export function buildDateRange(
  year: number,
  month?: number | null,
  day?: number | null,
): NormalizedDateRange {
  if (!Number.isInteger(year) || year <= 0) {
    throw new Error(`Invalid year: ${year}`);
  }

  if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    throw new Error(`Invalid month: ${month}`);
  }

  if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) {
    throw new Error(`Invalid day: ${day}`);
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  if (year && month && day) {
    const maxDay = daysInMonth(year, month);
    if (day > maxDay) {
      throw new Error(`Invalid day ${day} for ${year}-${pad(month)}`);
    }

    const d = `${year}-${pad(month)}-${pad(day)}`;

    return {
      start_date: d,
      end_date: d,
      sort_date: d,
      date_precision: 'day',
      date_modifier: 'exact',
      canonical_calendar: 'gregorian',
      date_original_text: `${pad(day)}-${pad(month)}-${year}`,
    };
  }

  if (year && month) {
    const start = `${year}-${pad(month)}-01`;
    const end = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;

    return {
      start_date: start,
      end_date: end,
      sort_date: `${year}-${pad(month)}-15`,
      date_precision: 'month',
      date_modifier: 'exact',
      canonical_calendar: 'gregorian',
      date_original_text: `${pad(month)}-${year}`,
    };
  }

  return {
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    sort_date: `${year}-06-30`,
    date_precision: 'year',
    date_modifier: 'exact',
    canonical_calendar: 'gregorian',
    date_original_text: String(year),
  };
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
