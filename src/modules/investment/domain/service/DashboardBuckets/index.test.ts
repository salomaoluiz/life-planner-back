import { bucketsFor, bucketUnitFor, DashboardBucket } from './index';

describe('bucketsFor', () => {
  it('SHOULD give one bucket per day for one month', () => {
    const buckets = bucketsFor('2026-11-01', '2026-11-04');

    expect(bucketUnitFor('2026-11-01', '2026-11-04')).toBe('DAY');
    expect(buckets).toHaveLength(4);
    expect(buckets[0]).toEqual({ end: '2026-11-01', start: '2026-11-01' });
    expect(buckets[3]).toEqual({ end: '2026-11-04', start: '2026-11-04' });
  });

  it('SHOULD give one bucket per week ending on Sunday for three months', () => {
    const buckets = bucketsFor('2026-08-05', '2026-11-04');

    expect(bucketUnitFor('2026-08-05', '2026-11-04')).toBe('WEEK');
    // 2026-08-05 is a Wednesday: the first bucket ends on the following Sunday.
    expect(buckets[0]).toEqual({ end: '2026-08-09', start: '2026-08-05' });
    expect(buckets[buckets.length - 1].end).toBe('2026-11-04');
    expect(buckets.every((bucket) => bucket.end >= bucket.start)).toBe(true);
  });

  it('SHOULD give one bucket per month, the last one cut at the period end', () => {
    const buckets = bucketsFor('2025-12-01', '2026-11-04');

    expect(bucketUnitFor('2025-12-01', '2026-11-04')).toBe('MONTH');
    expect(buckets).toHaveLength(12);
    expect(buckets[0]).toEqual({ end: '2025-12-31', start: '2025-12-01' });
    expect(buckets[buckets.length - 1]).toEqual({ end: '2026-11-04', start: '2026-11-01' });
  });

  it('SHOULD keep the buckets contiguous and inside the period', () => {
    const buckets: DashboardBucket[] = bucketsFor('2026-02-15', '2026-05-02');

    buckets.slice(1).forEach((bucket, index) => {
      expect(bucket.start > buckets[index].end).toBe(true);
    });
    expect(buckets[0].start).toBe('2026-02-15');
  });
});
