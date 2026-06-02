import { describe, expect, it } from 'vitest';
import { buildDateRange, daysInMonth } from '../../utils/date-parser/normalizeDate';

describe('buildDateRange', () => {
  it('handles year-only precision', () => {
    expect(buildDateRange(1980)).toMatchObject({
      start_date: '1980-01-01',
      end_date: '1980-12-31',
      sort_date: '1980-06-30',
      date_precision: 'year',
      date_modifier: 'exact',
      canonical_calendar: 'gregorian',
      date_original_text: '1980',
    });
  });

  it('handles month precision', () => {
    expect(buildDateRange(2001, 3)).toMatchObject({
      start_date: '2001-03-01',
      end_date: '2001-03-31',
      sort_date: '2001-03-15',
      date_precision: 'month',
      date_modifier: 'exact',
      canonical_calendar: 'gregorian',
      date_original_text: '03-2001',
    });
  });

  it('handles day precision', () => {
    expect(buildDateRange(1980, 3, 12)).toMatchObject({
      start_date: '1980-03-12',
      end_date: '1980-03-12',
      sort_date: '1980-03-12',
      date_precision: 'day',
      date_modifier: 'exact',
      canonical_calendar: 'gregorian',
      date_original_text: '12-03-1980',
    });
  });

  it('handles leap year February correctly', () => {
    expect(buildDateRange(2024, 2)).toMatchObject({
      start_date: '2024-02-01',
      end_date: '2024-02-29',
      sort_date: '2024-02-15',
      date_precision: 'month',
    });
  });

  it('rejects invalid month', () => {
    expect(() => buildDateRange(2001, 13)).toThrow('Invalid month');
  });

  it('rejects invalid day for month', () => {
    expect(() => buildDateRange(2023, 2, 29)).toThrow('Invalid day');
  });

  it('calculates days in month', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2001, 3)).toBe(31);
  });
});
