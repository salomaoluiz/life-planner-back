// Postgres `date` columns come back as a Date at UTC midnight: always read/write them in UTC so a
// calendar day never shifts with the server timezone.
export function fromCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
export function toCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
