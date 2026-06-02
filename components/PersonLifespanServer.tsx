import { getPersonDateEvents, type LegacyDatePerson } from '@/compat/date.compat';
import { formatLifespan } from '@/utils/calendar/ageCalculation';

type PersonLifespanServerProps = {
  supabase: any;
  person: LegacyDatePerson;
  className?: string;
};

export async function PersonLifespanServer({
  supabase,
  person,
  className,
}: PersonLifespanServerProps) {
  const { birthEvent, deathEvent } = await getPersonDateEvents(supabase, person);

  const text = formatLifespan(
    birthEvent,
    deathEvent,
    person.is_deceased !== true,
  );

  if (!text) return null;

  return <span className={className}>{text}</span>;
}
