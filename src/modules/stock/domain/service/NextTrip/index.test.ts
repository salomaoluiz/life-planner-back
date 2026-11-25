import { nextTripDate, suggestedInterval } from '@stock/domain/service/NextTrip';

const today = new Date('2026-11-25T00:00:00.000Z');

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

describe('nextTripDate', () => {
  it('SHOULD be today + interval WHEN there is no closed purchase', () => {
    expect(nextTripDate(undefined, 7, today)).toEqual(day('2026-12-02'));
  });

  it('SHOULD be the last closed purchase + interval', () => {
    expect(nextTripDate(day('2026-11-22'), 7, today)).toEqual(day('2026-11-29'));
  });

  it('SHOULD roll forward a missed trip to the next cycle', () => {
    // last 2026-11-01 + 7 = 11-08, +14 = 11-15, +21 = 11-22 (before today), +28 = 11-29
    expect(nextTripDate(day('2026-11-01'), 7, today)).toEqual(day('2026-11-29'));
  });

  it('SHOULD keep a trip that falls exactly today', () => {
    expect(nextTripDate(day('2026-11-18'), 7, today)).toEqual(today);
  });
});

describe('suggestedInterval', () => {
  it('SHOULD be null with fewer than 3 closed purchases', () => {
    expect(suggestedInterval([day('2026-11-01'), day('2026-11-08')])).toBeNull();
  });

  it('SHOULD be the median gap of the closed purchases', () => {
    expect(suggestedInterval([day('2026-11-01'), day('2026-11-08'), day('2026-11-22')])).toBe(11);
  });

  it('SHOULD use only the last 7 purchases (6 gaps)', () => {
    const dates = Array.from({ length: 8 }, (_, index) =>
      day(`2026-10-${String(index * 3 + 1).padStart(2, '0')}`),
    );

    expect(suggestedInterval(dates)).toBe(3);
  });

  it('SHOULD clamp to 1-90', () => {
    expect(suggestedInterval([day('2026-01-01'), day('2026-06-01'), day('2026-11-01')])).toBe(90);
    expect(suggestedInterval([day('2026-11-01'), day('2026-11-01'), day('2026-11-01')])).toBe(1);
  });
});
