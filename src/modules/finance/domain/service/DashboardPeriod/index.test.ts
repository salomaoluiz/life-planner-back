import {
  buildBuckets,
  defaultGranularity,
  isDashboardPeriodValid,
  isGranularityAllowed,
  previousPeriod,
} from './index';

describe('isGranularityAllowed', () => {
  it('SHOULD allow DAY up to 92 days and refuse 93', () => {
    expect(isGranularityAllowed('DAY', '2026-08-01', '2026-10-31')).toBe(true);
    expect(isGranularityAllowed('DAY', '2026-07-31', '2026-10-31')).toBe(false);
  });

  it('SHOULD allow WEEK up to one year and always MONTH', () => {
    expect(isGranularityAllowed('WEEK', '2025-11-01', '2026-10-31')).toBe(true);
    expect(isGranularityAllowed('WEEK', '2025-10-01', '2026-10-31')).toBe(false);
    expect(isGranularityAllowed('MONTH', '2024-11-01', '2026-10-31')).toBe(true);
  });
});

describe('defaultGranularity', () => {
  it('SHOULD pick DAY up to 31 days, WEEK up to 92 and MONTH otherwise', () => {
    expect(defaultGranularity('2026-10-01', '2026-10-31')).toBe('DAY');
    expect(defaultGranularity('2026-10-01', '2026-11-01')).toBe('WEEK');
    expect(defaultGranularity('2026-08-01', '2026-10-31')).toBe('WEEK');
    expect(defaultGranularity('2026-07-31', '2026-10-31')).toBe('MONTH');
  });
});

describe('buildBuckets', () => {
  it('SHOULD build month buckets clipped to the period', () => {
    expect(buildBuckets('2026-09-15', '2026-11-10', 'MONTH')).toEqual([
      { end: '2026-09-30', start: '2026-09-15' },
      { end: '2026-10-31', start: '2026-10-01' },
      { end: '2026-11-10', start: '2026-11-01' },
    ]);
  });

  it('SHOULD build 12 month buckets for a 12M period', () => {
    expect(buildBuckets('2025-11-01', '2026-10-31', 'MONTH')).toHaveLength(12);
  });

  it('SHOULD start weeks on Monday and clip the first and last across a year change', () => {
    // 2026-12-30 is a Wednesday; 2027-01-05 is a Tuesday.
    expect(buildBuckets('2026-12-30', '2027-01-05', 'WEEK')).toEqual([
      { end: '2027-01-03', start: '2026-12-30' },
      { end: '2027-01-05', start: '2027-01-04' },
    ]);
  });

  it('SHOULD build one bucket per day', () => {
    expect(buildBuckets('2026-10-01', '2026-10-03', 'DAY')).toHaveLength(3);
  });
});

describe('previousPeriod', () => {
  it('SHOULD shift a month-aligned period by whole months', () => {
    expect(previousPeriod('2025-11-01', '2026-10-31')).toEqual({
      from: '2024-11-01',
      to: '2025-10-31',
    });
  });

  it('SHOULD keep the same length for other periods', () => {
    expect(previousPeriod('2026-10-11', '2026-10-20')).toEqual({
      from: '2026-10-01',
      to: '2026-10-10',
    });
  });
});

describe('isDashboardPeriodValid', () => {
  it('SHOULD refuse a `to` after the end of the current month', () => {
    expect(isDashboardPeriodValid('2026-10-01', '2026-10-31', '2026-10-15')).toBe(true);
    expect(isDashboardPeriodValid('2026-10-01', '2026-11-01', '2026-10-15')).toBe(false);
  });

  it('SHOULD refuse more than 2 years and `to` before `from`', () => {
    expect(isDashboardPeriodValid('2024-10-01', '2026-10-31', '2026-10-15')).toBe(false);
    expect(isDashboardPeriodValid('2026-10-10', '2026-10-01', '2026-10-15')).toBe(false);
  });
});
