import { MarketIndexSeries } from '@investment/domain/enum';

import { isInRange, isStale, sourceOf } from './index';

describe('isInRange (FR 2)', () => {
  it.each([
    [MarketIndexSeries.CDI_DAILY, 0.0508, true],
    [MarketIndexSeries.CDI_DAILY, 0.2, true],
    [MarketIndexSeries.CDI_DAILY, 0.9, false],
    [MarketIndexSeries.SELIC_DAILY, 0, false],
    [MarketIndexSeries.CDI_ANNUAL, 60, true],
    [MarketIndexSeries.SELIC_TARGET, 60.1, false],
    [MarketIndexSeries.IPCA_MONTHLY, -5, true],
    [MarketIndexSeries.IPCA_MONTHLY, 10.1, false],
    [MarketIndexSeries.IPCA_12M, -10, true],
    [MarketIndexSeries.IPCA_EXPECTED_12M, 100.1, false],
  ])('SHOULD judge %s = %s as %s', (series, value, expected) => {
    expect(isInRange(series, value)).toBe(expected);
  });

  it('SHOULD refuse NaN', () => {
    expect(isInRange(MarketIndexSeries.IPCA_MONTHLY, Number.NaN)).toBe(false);
  });
});

describe('isStale (FR 7)', () => {
  it('SHOULD treat a missing series as stale', () => {
    expect(isStale(MarketIndexSeries.CDI_DAILY, undefined, '2026-11-16')).toBe(true);
  });

  it('SHOULD allow 4 business days for daily series', () => {
    // 2026-11-16 is a Monday; 2026-11-11 (Wed) is 3 business days before (11, 12, 13), 11-06 (Fri) is 6.
    expect(isStale(MarketIndexSeries.CDI_DAILY, '2026-11-11', '2026-11-16')).toBe(false);
    expect(isStale(MarketIndexSeries.CDI_DAILY, '2026-11-06', '2026-11-16')).toBe(true);
    expect(isStale(MarketIndexSeries.SELIC_TARGET, '2026-12-09', '2026-11-16')).toBe(false);
  });

  it('SHOULD allow 10 business days for the Focus expectation', () => {
    expect(isStale(MarketIndexSeries.IPCA_EXPECTED_12M, '2026-11-02', '2026-11-16')).toBe(false);
    expect(isStale(MarketIndexSeries.IPCA_EXPECTED_12M, '2026-10-26', '2026-11-16')).toBe(true);
  });

  it('SHOULD allow 45 days after the end of the reference month for monthly IPCA', () => {
    // October (dated 2026-10-01) ends 10-31: fresh until 12-15.
    expect(isStale(MarketIndexSeries.IPCA_MONTHLY, '2026-10-01', '2026-11-16')).toBe(false);
    expect(isStale(MarketIndexSeries.IPCA_12M, '2026-10-01', '2026-12-15')).toBe(false);
    expect(isStale(MarketIndexSeries.IPCA_12M, '2026-10-01', '2026-12-16')).toBe(true);
  });
});

describe('sourceOf', () => {
  it('SHOULD tag Focus rows BCB_FOCUS AND the rest BCB_SGS', () => {
    expect(sourceOf(MarketIndexSeries.IPCA_EXPECTED_12M)).toBe('BCB_FOCUS');
    expect(sourceOf(MarketIndexSeries.CDI_DAILY)).toBe('BCB_SGS');
  });
});
