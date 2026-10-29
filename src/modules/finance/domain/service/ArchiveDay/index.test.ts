import { AccountStatus } from '@finance/domain/enum';

import { archivedAtFor, archiveDay, countsOnDay } from './index';

describe('archiveDay', () => {
  it('SHOULD be undefined WHEN never archived', () => {
    expect(archiveDay(undefined)).toBeUndefined();
    expect(archiveDay(null)).toBeUndefined();
  });

  it('SHOULD follow the São Paulo calendar day, not UTC', () => {
    expect(archiveDay(new Date('2026-10-10T01:30:00Z'))).toBe('2026-10-09');
    expect(archiveDay(new Date('2026-10-10T15:00:00Z'))).toBe('2026-10-10');
  });
});

describe('countsOnDay', () => {
  const archived = new Date('2026-10-10T15:00:00Z');

  it('SHOULD count the days before the archive day only', () => {
    expect(countsOnDay(archived, '2026-10-09')).toBe(true);
    expect(countsOnDay(archived, '2026-10-10')).toBe(false);
    expect(countsOnDay(archived, '2026-10-11')).toBe(false);
  });

  it('SHOULD always count WHEN never archived', () => {
    expect(countsOnDay(null, '2030-01-01')).toBe(true);
    expect(countsOnDay(undefined, '2030-01-01')).toBe(true);
  });
});

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
