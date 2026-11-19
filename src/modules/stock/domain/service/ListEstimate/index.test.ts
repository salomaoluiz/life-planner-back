import { resolveUnitPrice, rowEstimateCents, summarizeEstimates } from './index';

describe('rowEstimateCents', () => {
  it('SHOULD multiply and round half-up per row', () => {
    expect(rowEstimateCents(489, 6)).toBe(2934);
    expect(rowEstimateCents(333, 1.5)).toBe(500);
    expect(rowEstimateCents(1, 0.5)).toBe(1);
  });
});

describe('resolveUnitPrice', () => {
  it('SHOULD answer MANUAL with a typed price and NONE without one', () => {
    expect(resolveUnitPrice(489)).toEqual({ priceSource: 'MANUAL', unitPriceCents: 489 });
    expect(resolveUnitPrice()).toEqual({ priceSource: 'NONE' });
  });
});

describe('summarizeEstimates', () => {
  it('SHOULD total the priced rows and count them', () => {
    expect(summarizeEstimates([100, undefined, 250])).toEqual({
      estimatedTotalCents: 350,
      pricedCount: 2,
      rowCount: 3,
    });
    expect(summarizeEstimates([])).toEqual({ estimatedTotalCents: 0, pricedCount: 0, rowCount: 0 });
  });
});
