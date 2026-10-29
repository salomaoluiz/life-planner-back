import { AccountStatus } from '@finance/domain/enum';

import { archivedAtFor } from './index';

describe('archivedAtFor', () => {
  const now = new Date('2026-10-10T15:00:00Z');

  it('SHOULD set now WHEN archiving', () => {
    expect(archivedAtFor(AccountStatus.ACTIVE, AccountStatus.ARCHIVED, now)).toBe(now);
  });

  it('SHOULD clear WHEN reactivating', () => {
    expect(archivedAtFor(AccountStatus.ARCHIVED, AccountStatus.ACTIVE, now)).toBeNull();
  });

  it.each([
    [AccountStatus.ARCHIVED, AccountStatus.ARCHIVED],
    [AccountStatus.ACTIVE, AccountStatus.ACTIVE],
    [AccountStatus.ACTIVE, undefined],
  ])('SHOULD leave it untouched WHEN %s → %s', (previous, next) => {
    expect(archivedAtFor(previous, next, now)).toBeUndefined();
  });
});
