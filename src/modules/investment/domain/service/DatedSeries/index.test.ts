import { latestOnOrBefore } from './index';

const rows = [{ date: '2026-03-10' }, { date: '2026-06-30' }, { date: '2026-09-01' }];

describe('latestOnOrBefore', () => {
  it('SHOULD return undefined WHEN the date is before the first row', () => {
    expect(latestOnOrBefore(rows, '2026-03-09')).toBeUndefined();
  });

  it('SHOULD return the row of an exact date', () => {
    expect(latestOnOrBefore(rows, '2026-06-30')).toBe(rows[1]);
  });

  it('SHOULD return the previous row WHEN the date falls between two rows', () => {
    expect(latestOnOrBefore(rows, '2026-07-15')).toBe(rows[1]);
  });

  it('SHOULD return the last row WHEN the date is after every row', () => {
    expect(latestOnOrBefore(rows, '2030-01-01')).toBe(rows[2]);
  });

  it('SHOULD return undefined for an empty series', () => {
    expect(latestOnOrBefore([], '2026-01-01')).toBeUndefined();
  });
});
