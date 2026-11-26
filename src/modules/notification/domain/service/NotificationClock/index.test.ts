import {
  addDaysToDate,
  instantOf,
  isDueForSummary,
  isDueForUrgent,
  isInsideQuietHours,
  isValidTimeZone,
  localMoment,
  minuteOfTime,
  pushNotBefore,
  timeOfMinute,
} from './index';

const SP = 'America/Sao_Paulo';
const base = {
  lastSummaryOn: null,
  quietEndMinute: 420,
  quietStartMinute: 1320,
  summaryMinute: 480,
  timeZone: SP,
};

describe('localMoment', () => {
  it('SHOULD read the local date and minute (São Paulo is UTC-3, no DST)', () => {
    expect(localMoment(new Date('2026-11-23T11:05:00Z'), SP)).toEqual({
      date: '2026-11-23',
      minute: 485,
    });
    expect(localMoment(new Date('2026-11-23T02:30:00Z'), SP)).toEqual({
      date: '2026-11-22',
      minute: 1410,
    });
  });

  it('SHOULD follow a DST zone (New York: UTC-5 in winter, UTC-4 in summer)', () => {
    const ny = 'America/New_York';

    expect(localMoment(new Date('2026-01-15T13:00:00Z'), ny).minute).toBe(8 * 60);
    expect(localMoment(new Date('2026-07-15T12:00:00Z'), ny).minute).toBe(8 * 60);
  });
});

describe('isDueForSummary', () => {
  it('SHOULD be due from the summary time on WHEN no summary was sent today', () => {
    expect(isDueForSummary(base, new Date('2026-11-23T11:00:00Z'))).toBe(true);
    expect(isDueForSummary(base, new Date('2026-11-23T10:59:00Z'))).toBe(false);
  });

  it('SHOULD be due on a later tick of the same day (API was down at 08:00)', () => {
    expect(isDueForSummary(base, new Date('2026-11-23T12:10:00Z'))).toBe(true);
  });

  it('SHOULD NOT be due WHEN the summary of the local date already exists', () => {
    expect(
      isDueForSummary({ ...base, lastSummaryOn: '2026-11-23' }, new Date('2026-11-23T14:00:00Z')),
    ).toBe(false);
    expect(
      isDueForSummary({ ...base, lastSummaryOn: '2026-11-22' }, new Date('2026-11-23T14:00:00Z')),
    ).toBe(true);
  });

  it('SHOULD skip the day after 23:59 local (no yesterday summary)', () => {
    expect(isDueForSummary(base, new Date('2026-11-24T02:58:00Z'))).toBe(true); // 23:58
    expect(isDueForSummary(base, new Date('2026-11-24T02:59:00Z'))).toBe(false); // 23:59
  });
});

describe('isDueForUrgent', () => {
  it('SHOULD be true only once the summary of the local date exists', () => {
    const now = new Date('2026-11-23T17:00:00Z');

    expect(isDueForUrgent({ ...base, lastSummaryOn: '2026-11-23' }, now)).toBe(true);
    expect(isDueForUrgent({ ...base, lastSummaryOn: '2026-11-22' }, now)).toBe(false);
    expect(isDueForUrgent(base, now)).toBe(false);
  });
});

describe('isInsideQuietHours', () => {
  it('SHOULD handle a window that crosses midnight', () => {
    expect(isInsideQuietHours(1380, 1320, 420)).toBe(true);
    expect(isInsideQuietHours(60, 1320, 420)).toBe(true);
    expect(isInsideQuietHours(420, 1320, 420)).toBe(false);
    expect(isInsideQuietHours(720, 1320, 420)).toBe(false);
  });

  it('SHOULD handle a window inside one day', () => {
    expect(isInsideQuietHours(600, 540, 660)).toBe(true);
    expect(isInsideQuietHours(660, 540, 660)).toBe(false);
  });

  it('SHOULD mean no quiet hours WHEN start equals end', () => {
    expect(isInsideQuietHours(0, 600, 600)).toBe(false);
    expect(isInsideQuietHours(600, 600, 600)).toBe(false);
  });
});

describe('pushNotBefore', () => {
  it('SHOULD be now outside quiet hours', () => {
    const now = new Date('2026-11-23T15:00:00Z');

    expect(pushNotBefore(base, now)).toEqual(now);
  });

  it('SHOULD wait until 07:00 tomorrow WHEN found at 23:00 (before midnight)', () => {
    expect(pushNotBefore(base, new Date('2026-11-24T02:00:00Z')).toISOString()).toBe(
      '2026-11-24T10:00:00.000Z',
    );
  });

  it('SHOULD wait until 07:00 today WHEN found at 03:00 (after midnight)', () => {
    expect(pushNotBefore(base, new Date('2026-11-23T06:00:00Z')).toISOString()).toBe(
      '2026-11-23T10:00:00.000Z',
    );
  });

  it('SHOULD end a same-day window today', () => {
    const preferences = { ...base, quietEndMinute: 660, quietStartMinute: 540 };

    expect(pushNotBefore(preferences, new Date('2026-11-23T12:30:00Z')).toISOString()).toBe(
      '2026-11-23T14:00:00.000Z',
    );
  });
});

describe('instantOf', () => {
  it('SHOULD resolve a local time to the right UTC instant across DST', () => {
    expect(instantOf('2026-01-15', 480, 'America/New_York').toISOString()).toBe(
      '2026-01-15T13:00:00.000Z',
    );
    expect(instantOf('2026-07-15', 480, 'America/New_York').toISOString()).toBe(
      '2026-07-15T12:00:00.000Z',
    );
  });
});

it('SHOULD validate IANA names', () => {
  expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
  expect(isValidTimeZone('Mars/Base')).toBe(false);
});

it('SHOULD add days to a calendar date AND convert HH:mm both ways', () => {
  expect(addDaysToDate('2026-11-30', 1)).toBe('2026-12-01');
  expect(minuteOfTime('08:15')).toBe(495);
  expect(timeOfMinute(495)).toBe('08:15');
});
