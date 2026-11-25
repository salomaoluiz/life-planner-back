// Spec 121 FR 21: the calendar day (`YYYY-MM-DD`) of an instant in the configured time zone.
export function usageDay(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(now);
  function part(type: string) {
    return parts.find((entry) => entry.type === type)?.value ?? '';
  }

  return `${part('year')}-${part('month')}-${part('day')}`;
}
