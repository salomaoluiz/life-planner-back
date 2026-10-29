import { AccountStatus } from '@finance/domain/enum';

// Spec 052 FR 4: the archive day is the São Paulo calendar day of `archived_at` (the day convention of the dashboard).
const TIME_ZONE = 'America/Sao_Paulo';

// `Date` → set now (archiving), `null` → clear (reactivating), `undefined` → leave as is.
export function archivedAtFor(
  previous: AccountStatus,
  next: AccountStatus | undefined,
  now: Date,
): Date | null | undefined {
  if (next === AccountStatus.ARCHIVED && previous !== AccountStatus.ARCHIVED) {
    return now;
  }

  return next === AccountStatus.ACTIVE && previous === AccountStatus.ARCHIVED ? null : undefined;
}
export function archiveDay(archivedAt: Date | null | undefined): string | undefined {
  if (!archivedAt) {
    return undefined;
  }

  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: TIME_ZONE,
    year: 'numeric',
  }).format(archivedAt);
}

// A source counts on a day only before its archive day.
export function countsOnDay(archivedAt: Date | null | undefined, day: string): boolean {
  const archived = archiveDay(archivedAt);

  return archived === undefined || day < archived;
}
