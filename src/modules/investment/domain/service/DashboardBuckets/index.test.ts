import { bucketEnds, bucketFor, incomeBucketEnds } from './index';

describe('bucketFor', () => {
  it.each([
    ['2026-10-01', '2026-10-31', 'DAY'],
    ['2026-09-20', '2026-11-03', 'DAY'], // 45 days
    ['2026-09-19', '2026-11-03', 'WEEK'], // 46 days
    ['2026-09-01', '2026-11-30', 'WEEK'], // 91 days (3M preset)
    ['2026-09-04', '2026-12-04', 'WEEK'], // 92 days
    ['2026-09-03', '2026-12-04', 'MONTH'], // 93 days
    ['2025-12-01', '2026-11-04', 'MONTH'],
  ])('SHOULD pick the bucket of %s..%s = %s', (from, to, expected) => {
    expect(bucketFor(from, to)).toBe(expected);
  });
});

describe('bucketEnds', () => {
  it('SHOULD give one end per day, the last one equal to `to`', () => {
    expect(bucketEnds('2026-11-01', '2026-11-04', 'DAY')).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
  });

  it('SHOULD end weeks on Sunday AND clip the last bucket to `to`', () => {
    // 2026-11-01 is a Sunday
    expect(bucketEnds('2026-10-28', '2026-11-12', 'WEEK')).toEqual([
      '2026-11-01',
      '2026-11-08',
      '2026-11-12',
    ]);
  });

  it('SHOULD give 12 monthly ends for 12M, the last clipped to today', () => {
    const ends = bucketEnds('2025-12-01', '2026-11-04', 'MONTH');

    expect(ends).toHaveLength(12);
    expect(ends[0]).toBe('2025-12-31');
    expect(ends[2]).toBe('2026-02-28');
    expect(ends[11]).toBe('2026-11-04');
  });

  it('SHOULD end February on the 29th in a leap year', () => {
    expect(bucketEnds('2028-02-01', '2028-03-31', 'MONTH')).toEqual(['2028-02-29', '2028-03-31']);
  });

  it('SHOULD not repeat `to` WHEN it is already a bucket end', () => {
    expect(bucketEnds('2026-10-01', '2026-10-31', 'MONTH')).toEqual(['2026-10-31']);
  });
});

describe('incomeBucketEnds', () => {
  it('SHOULD use weeks for 1M AND 3M, months above', () => {
    expect(incomeBucketEnds('2026-11-01', '2026-11-04')).toEqual(['2026-11-01', '2026-11-04']);
    expect(incomeBucketEnds('2025-12-01', '2026-11-04')).toHaveLength(12);
  });
});
