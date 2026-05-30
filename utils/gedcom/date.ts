const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export function formatGedcomDate(
  year?: number | null,
  month?: number | null,
  day?: number | null,
  modifier?: string | null,
) {
  if (!year) return null;

  const prefixMap: Record<string, string> = {
    about: 'ABT',
    before: 'BEF',
    after: 'AFT',
    estimated: 'EST',
    calculated: 'CAL',
    exact: '',
    '': '',
  };

  const prefix = modifier ? (prefixMap[modifier] ?? '') : '';
  const parts: string[] = [];

  if (day && day > 0) parts.push(String(day).padStart(2, '0'));
  if (month && month >= 1 && month <= 12) parts.push(MONTHS[month - 1]);
  parts.push(String(year));

  return prefix ? `${prefix} ${parts.join(' ')}` : parts.join(' ');
}
