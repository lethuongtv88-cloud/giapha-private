import { getPersonTimelineEvents } from '@/compat/personTimeline.compat';
import { PersonTimeline } from '@/components/PersonTimeline';

type PersonTimelineServerProps = {
  supabase: any;
  personId: string;
  className?: string;
};

export async function PersonTimelineServer({
  supabase,
  personId,
  className,
}: PersonTimelineServerProps) {
  const events = await getPersonTimelineEvents(supabase, personId);

  return (
    <PersonTimeline
      events={events}
      className={className}
    />
  );
}
