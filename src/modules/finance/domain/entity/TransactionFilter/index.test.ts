import { hasFilter, isPeriodValid } from './index';

describe('isPeriodValid', () => {
  it('SHOULD accept exactly two years', () => {
    expect(isPeriodValid('2024-01-01', '2025-12-31')).toBe(true);
  });

  it('SHOULD refuse more than two years', () => {
    expect(isPeriodValid('2024-01-01', '2026-01-01')).toBe(false);
  });

  it('SHOULD refuse an end before the start', () => {
    expect(isPeriodValid('2025-02-01', '2025-01-01')).toBe(false);
  });

  it('SHOULD accept a single day', () => {
    expect(isPeriodValid('2025-02-01', '2025-02-01')).toBe(true);
  });
});

describe('hasFilter', () => {
  it('SHOULD be false for nothing or empty lists', () => {
    expect(hasFilter()).toBe(false);
    expect(hasFilter({ categoryIds: [] })).toBe(false);
  });

  it('SHOULD be true when any field is set', () => {
    expect(hasFilter({ paid: false })).toBe(true);
    expect(hasFilter({ tagIds: ['t1'] })).toBe(true);
  });
});
