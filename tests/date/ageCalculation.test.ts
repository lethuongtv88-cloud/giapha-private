import { describe, expect, it, vi, afterEach } from 'vitest';
import { calculateAgeFromEvents, formatLifespan } from '../../utils/calendar/ageCalculation';

describe('calculateAgeFromEvents', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates exact age for exact birth and exact death', () => {
    const age = calculateAgeFromEvents(
      { start_date: '1945-03-12', end_date: '1945-03-12', date_precision: 'day' },
      { start_date: '2001-03-11', end_date: '2001-03-11', date_precision: 'day' },
    );

    expect(age).toMatchObject({
      minAge: 55,
      maxAge: 55,
      precision: 'exact',
      displayShort: '55 tuổi',
    });
  });

  it('calculates exact living age based on today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T00:00:00Z'));

    const age = calculateAgeFromEvents(
      { start_date: '1980-03-12', end_date: '1980-03-12', date_precision: 'day' },
      null,
    );

    expect(age).toMatchObject({
      minAge: 46,
      maxAge: 46,
      precision: 'exact',
      displayShort: '46 tuổi',
    });
  });

  it('handles year-only birth as age range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T00:00:00Z'));

    const age = calculateAgeFromEvents(
      { start_date: '1980-01-01', end_date: '1980-12-31', date_precision: 'year' },
      null,
    );

    expect(age.precision).toBe('year_only');
    expect(age.minAge).toBeLessThanOrEqual(age.maxAge);
    expect(age.displayShort).toContain('~');
  });

  it('handles month precision as partial age', () => {
    const age = calculateAgeFromEvents(
      { start_date: '1945-01-01', end_date: '1945-12-31', date_precision: 'year' },
      { start_date: '2001-03-01', end_date: '2001-03-31', date_precision: 'month' },
    );

    expect(age.precision).toBe('year_only');
    expect(age.displayShort).toContain('~');
  });
});

describe('formatLifespan', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not calculate current age for deceased person without death date', () => {
    const out = formatLifespan(
      { start_date: '1945-01-01', end_date: '1945-12-31', date_precision: 'year' },
      null,
      false,
    );

    expect(out).toBe('~1945 – ?');
  });

  it('shows living person age label', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T00:00:00Z'));

    const out = formatLifespan(
      { start_date: '1980-01-01', end_date: '1980-12-31', date_precision: 'year' },
      null,
      true,
    );

    expect(out).toContain('~1980 – nay');
    expect(out).toContain('tuổi');
  });

  it('shows death year for deceased person with death event', () => {
    const out = formatLifespan(
      { start_date: '1945-01-01', end_date: '1945-12-31', date_precision: 'year' },
      { start_date: '2001-03-01', end_date: '2001-03-31', date_precision: 'month' },
      false,
    );

    expect(out).toContain('~1945 – ~2001');
    expect(out).toContain('tuổi');
  });

  it('returns empty string when missing birth event', () => {
    expect(formatLifespan(null, null, true)).toBe('');
  });
});
