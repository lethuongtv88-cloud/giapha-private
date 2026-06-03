import { formatLifespan } from '@/utils/calendar/ageCalculation';
import type { AgeEvent } from '@/utils/calendar/ageCalculation';

type PersonLifespanProps = {
  birthEvent: AgeEvent | null;
  deathEvent: AgeEvent | null;
  isLiving: boolean;
  className?: string;
};

export function PersonLifespan({
  birthEvent,
  deathEvent,
  isLiving,
  className,
}: PersonLifespanProps) {
  const text = formatLifespan(birthEvent, deathEvent, isLiving);

  if (!text) return null;

  return (
    <span className={className}>
      {text}
    </span>
  );
}
