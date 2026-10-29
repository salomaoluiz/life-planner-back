import { AccountStatus } from '@finance/domain/enum';

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
