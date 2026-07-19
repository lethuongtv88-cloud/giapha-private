import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockFeatureFlags = vi.hoisted(() => ({
  readEvents: false,
}));

vi.mock('../../lib/featureFlags', () => ({
  featureFlags: mockFeatureFlags,
}));

import {
  getBirthEventFromLegacy,
  getDeathEventFromLegacy,
  getPersonDateEvents,
} from '../../compat/date.compat';

describe('date compat legacy helpers', () => {
  it('builds birth event from legacy year only', () => {
    const birth = getBirthEventFromLegacy({
      id: 'p1',
      birth_year: 1980,
    });

    expect(birth).toMatchObject({
      start_date: '1980-01-01',
      end_date: '1980-12-31',
      date_precision: 'year',
    });
  });

  it('builds death event from legacy month precision', () => {
    const death = getDeathEventFromLegacy({
      id: 'p1',
      is_deceased: true,
      death_year: 2001,
      death_month: 3,
    });

    expect(death).toMatchObject({
      start_date: '2001-03-01',
      end_date: '2001-03-31',
      date_precision: 'month',
    });
  });

  it('does not create death event for deceased person without death year', () => {
    const death = getDeathEventFromLegacy({
      id: 'p1',
      is_deceased: true,
    });

    expect(death).toBeNull();
  });
});

describe('getPersonDateEvents', () => {
  beforeEach(() => {
    mockFeatureFlags.readEvents = false;
  });

  it('uses legacy when READ_EVENTS=false', async () => {
    mockFeatureFlags.readEvents = false;

    const supabase = {
      from: vi.fn(),
    };

    const out = await getPersonDateEvents(supabase, {
      id: 'p1',
      birth_year: 1980,
      death_year: 2001,
      death_month: 3,
      is_deceased: true,
    });

    expect(out.birthEvent?.date_precision).toBe('year');
    expect(out.deathEvent?.date_precision).toBe('month');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('uses event model when READ_EVENTS=true', async () => {
    mockFeatureFlags.readEvents = true;

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [
              {
                events: {
                  type: 'birth',
                  start_date: '1980-03-12',
                  end_date: '1980-03-12',
                  date_precision: 'day',
                },
              },
            ],
            error: null,
          })),
        })),
      })),
    };

    const out = await getPersonDateEvents(supabase, {
      id: 'p1',
      birth_year: 1980,
    });

    expect(out.birthEvent).toMatchObject({
      start_date: '1980-03-12',
      end_date: '1980-03-12',
      date_precision: 'day',
    });
  });

  it('falls back to legacy when READ_EVENTS=true but event is missing', async () => {
    mockFeatureFlags.readEvents = true;

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [],
            error: null,
          })),
        })),
      })),
    };

    const out = await getPersonDateEvents(supabase, {
      id: 'p1',
      birth_year: 1980,
    });

    expect(out.birthEvent).toMatchObject({
      start_date: '1980-01-01',
      end_date: '1980-12-31',
      date_precision: 'year',
    });
  });
});
