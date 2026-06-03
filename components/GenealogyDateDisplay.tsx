import type { AgeEvent } from '@/utils/calendar/ageCalculation';

type GenealogyDateDisplayProps = {
  event: AgeEvent | null;
  label?: string;
  className?: string;
};

export function GenealogyDateDisplay({
  event,
  label,
  className,
}: GenealogyDateDisplayProps) {
  if (!event?.start_date) return null;

  const text = formatEventDate(event);

  return (
    <span className={className}>
      {label ? `${label}: ${text}` : text}
    </span>
  );
}

export function formatEventDate(event: AgeEvent) {
  if (!event.start_date) return '';

  const [year, month, day] = event.start_date.split('-');

  if (event.date_precision === 'day') {
    return `${day}-${month}-${year}`;
  }

  if (event.date_precision === 'month') {
    return `${month}-${year}`;
  }

  if (event.date_precision === 'year') {
    return year;
  }

  return year;
}
