import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { buildDateRange } from '../utils/date-parser/normalizeDate';

dotenvConfig({ path: '.env.local', override: true });

const DRY_RUN = process.env.DRY_RUN !== 'false';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: WebSocket as any,
  },
});

type PersonRow = {
  id: string;
  full_name: string | null;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  death_lunar_year: number | null;
  death_lunar_month: number | null;
  death_lunar_day: number | null;
  is_deceased: boolean | null;
};

type PlannedEvent = {
  personId: string;
  personName: string;
  type: 'birth' | 'death';
  title: string;
  role: 'principal' | 'deceased';
  legacySource: 'persons.birth_*' | 'persons.death_*';
  eventPayload: Record<string, unknown>;
};

type InvalidCase = {
  personId: string;
  personName: string;
  type: 'birth' | 'death';
  reason: string;
};

type SkippedCase = {
  personId: string;
  personName: string;
  reason: string;
};

type MigrationReport = {
  personsRead: number;
  birthWouldCreate: number;
  deathWouldCreate: number;
  birthCreated: number;
  deathCreated: number;
  birthExisting: number;
  deathExisting: number;
  personEventLinksCreated: number;
  personEventLinksExistingOrSkipped: number;
  deceasedWithoutDeathDate: number;
  skipped: SkippedCase[];
  invalid: InvalidCase[];
};

async function main() {
  console.log('=== EVENT DATE MIGRATION SAFE ===');
  console.log(`DRY_RUN = ${DRY_RUN}`);
  console.log('');

  await assertServiceRole();

  const persons = await loadPersons();

  const report: MigrationReport = {
    personsRead: persons.length,
    birthWouldCreate: 0,
    deathWouldCreate: 0,
    birthCreated: 0,
    deathCreated: 0,
    birthExisting: 0,
    deathExisting: 0,
    personEventLinksCreated: 0,
    personEventLinksExistingOrSkipped: 0,
    deceasedWithoutDeathDate: 0,
    skipped: [],
    invalid: [],
  };

  const plannedEvents: PlannedEvent[] = [];

  for (const person of persons) {
    const personName = person.full_name || '(no name)';

    if (person.birth_year) {
      try {
        const dateRange = buildDateRange(
          person.birth_year,
          person.birth_month,
          person.birth_day,
        );

        plannedEvents.push({
          personId: person.id,
          personName,
          type: 'birth',
          title: `Sinh: ${personName}`,
          role: 'principal',
          legacySource: 'persons.birth_*',
          eventPayload: {
            type: 'birth',
            title: `Sinh: ${personName}`,
            ...dateRange,
            legacy_person_id: person.id,
            legacy_source: 'persons.birth_*',
            migration_confidence: 'certain',
          },
        });

        report.birthWouldCreate += 1;
      } catch (error) {
        report.invalid.push({
          personId: person.id,
          personName,
          type: 'birth',
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (person.is_deceased === true) {
      if (person.death_year) {
        try {
          const dateRange = buildDateRange(
            person.death_year,
            person.death_month,
            person.death_day,
          );

          plannedEvents.push({
            personId: person.id,
            personName,
            type: 'death',
            title: `Mất: ${personName}`,
            role: 'deceased',
            legacySource: 'persons.death_*',
            eventPayload: {
              type: 'death',
              title: `Mất: ${personName}`,
              ...dateRange,
              lunar_year: person.death_lunar_year,
              lunar_month: person.death_lunar_month,
              lunar_day: person.death_lunar_day,
              lunar_is_leap_month: false,
              legacy_person_id: person.id,
              legacy_source: 'persons.death_*',
              migration_confidence: 'certain',
            },
          });

          report.deathWouldCreate += 1;
        } catch (error) {
          report.invalid.push({
            personId: person.id,
            personName,
            type: 'death',
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        report.deceasedWithoutDeathDate += 1;
        report.skipped.push({
          personId: person.id,
          personName,
          reason: 'skipped_no_death_year',
        });
      }
    }
  }

  if (DRY_RUN) {
    printReport(report, plannedEvents);
    console.log('');
    console.log('DRY RUN DONE. No rows were inserted into events/person_events.');
    return;
  }

  await markMigrationRunning();

  for (const item of plannedEvents) {
    const existingEventId = await findExistingLegacyEvent(
      item.personId,
      item.type,
      item.legacySource,
    );

    let eventId = existingEventId;

    if (eventId) {
      if (item.type === 'birth') report.birthExisting += 1;
      if (item.type === 'death') report.deathExisting += 1;
    } else {
      eventId = await insertEvent(item.eventPayload);

      if (item.type === 'birth') report.birthCreated += 1;
      if (item.type === 'death') report.deathCreated += 1;
    }

    const linkCreated = await ensurePersonEventLink(
      item.personId,
      eventId,
      item.role,
    );

    if (linkCreated) {
      report.personEventLinksCreated += 1;
    } else {
      report.personEventLinksExistingOrSkipped += 1;
    }
  }

  await markMigrationDone(report);

  printReport(report, plannedEvents);
  console.log('');
  console.log('REAL RUN DONE.');
}

async function assertServiceRole() {
  const parts = serviceRoleKey!.split('.');
  if (parts.length < 2) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY does not look like a JWT');
  }

  const payload = JSON.parse(
    Buffer.from(parts[1], 'base64url').toString('utf8'),
  );

  if (payload.role !== 'service_role') {
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY role is ${payload.role}, expected service_role`);
  }

  console.log(`service role OK: role=${payload.role}, ref=${payload.ref ?? 'unknown'}`);
  console.log('');
}

async function loadPersons(): Promise<PersonRow[]> {
  const { data, error } = await supabase
    .from('persons_active')
    .select(`
      id,
      full_name,
      birth_year,
      birth_month,
      birth_day,
      death_year,
      death_month,
      death_day,
      death_lunar_year,
      death_lunar_month,
      death_lunar_day,
      is_deceased
    `)
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load persons_active: ${error.message}`);
  }

  return (data ?? []) as PersonRow[];
}

async function findExistingLegacyEvent(
  legacyPersonId: string,
  type: 'birth' | 'death',
  legacySource: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('legacy_person_id', legacyPersonId)
    .eq('type', type)
    .eq('legacy_source', legacySource)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing ${type} event for ${legacyPersonId}: ${error.message}`);
  }

  return data?.id ?? null;
}

async function insertEvent(payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase
    .from('events')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to insert event: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error('Inserted event but no id returned');
  }

  return data.id;
}

async function ensurePersonEventLink(
  personId: string,
  eventId: string,
  role: 'principal' | 'deceased',
): Promise<boolean> {
  const { data: existing, error: selectError } = await supabase
    .from('person_events')
    .select('id')
    .eq('person_id', personId)
    .eq('event_id', eventId)
    .eq('role', role)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to check person_event link: ${selectError.message}`);
  }

  if (existing?.id) {
    return false;
  }

  const { error: insertError } = await supabase
    .from('person_events')
    .insert({
      person_id: personId,
      event_id: eventId,
      role,
    });

  if (insertError) {
    throw new Error(`Failed to insert person_event link: ${insertError.message}`);
  }

  return true;
}

async function markMigrationRunning() {
  const { error } = await supabase
    .from('migration_log')
    .upsert(
      {
        name: 'migrate-dates-to-events-v234',
        status: 'running',
        dry_run: false,
        started_at: new Date().toISOString(),
        error: null,
      },
      { onConflict: 'name' },
    );

  if (error) {
    console.warn(`WARN: Could not write migration_log running state: ${error.message}`);
  }
}

async function markMigrationDone(report: MigrationReport) {
  const { error } = await supabase
    .from('migration_log')
    .upsert(
      {
        name: 'migrate-dates-to-events-v234',
        status: 'done',
        dry_run: false,
        rows_read: report.personsRead,
        rows_written: report.birthCreated + report.deathCreated,
        rows_skipped: report.skipped.length,
        rows_review: report.invalid.length,
        finished_at: new Date().toISOString(),
        error: null,
      },
      { onConflict: 'name' },
    );

  if (error) {
    console.warn(`WARN: Could not write migration_log done state: ${error.message}`);
  }
}

function printReport(report: MigrationReport, plannedEvents: PlannedEvent[]) {
  console.log('=== REPORT ===');
  console.log(`persons read: ${report.personsRead}`);
  console.log(`birth events would create: ${report.birthWouldCreate}`);
  console.log(`death events would create: ${report.deathWouldCreate}`);
  console.log(`birth events created: ${report.birthCreated}`);
  console.log(`death events created: ${report.deathCreated}`);
  console.log(`birth events existing: ${report.birthExisting}`);
  console.log(`death events existing: ${report.deathExisting}`);
  console.log(`person_event links created: ${report.personEventLinksCreated}`);
  console.log(`person_event links existing/skipped: ${report.personEventLinksExistingOrSkipped}`);
  console.log(`deceased without death_year: ${report.deceasedWithoutDeathDate}`);
  console.log(`invalid dates: ${report.invalid.length}`);
  console.log(`skipped: ${report.skipped.length}`);
  console.log('');

  if (report.invalid.length > 0) {
    console.log('=== INVALID DATES ===');
    for (const item of report.invalid.slice(0, 50)) {
      console.log(`${item.type}: ${item.personName} (${item.personId}) — ${item.reason}`);
    }

    if (report.invalid.length > 50) {
      console.log(`... and ${report.invalid.length - 50} more invalid cases`);
    }

    console.log('');
  }

  if (report.skipped.length > 0) {
    console.log('=== SKIPPED SAMPLE ===');
    for (const item of report.skipped.slice(0, 30)) {
      console.log(`${item.personName} (${item.personId}) — ${item.reason}`);
    }

    if (report.skipped.length > 30) {
      console.log(`... and ${report.skipped.length - 30} more skipped cases`);
    }

    console.log('');
  }

  console.log('=== PLANNED EVENT SAMPLE ===');
  for (const item of plannedEvents.slice(0, 20)) {
    const start = item.eventPayload.start_date ?? '';
    const end = item.eventPayload.end_date ?? '';
    const precision = item.eventPayload.date_precision ?? '';
    console.log(`${item.type}: ${item.personName} — ${start} → ${end} (${precision})`);
  }

  if (plannedEvents.length > 20) {
    console.log(`... and ${plannedEvents.length - 20} more planned events`);
  }
}

main().catch(async (error) => {
  console.error('');
  console.error('EVENT DATE MIGRATION FAILED');
  console.error(error);

  if (!DRY_RUN) {
    await supabase
      .from('migration_log')
      .upsert(
        {
          name: 'migrate-dates-to-events-v234',
          status: 'failed',
          dry_run: false,
          error: error instanceof Error ? error.message : String(error),
          finished_at: new Date().toISOString(),
        },
        { onConflict: 'name' },
      );
  }

  process.exit(1);
});
