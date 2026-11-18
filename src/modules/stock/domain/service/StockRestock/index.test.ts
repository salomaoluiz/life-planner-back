import { needsRestock, restockQuantity } from './index';

describe('needsRestock', () => {
  it('SHOULD flag quantity <= min, and only at 0 WHEN there is no min', () => {
    expect(needsRestock(false, 2, 2)).toBe(true);
    expect(needsRestock(false, 3, 2)).toBe(false);
    expect(needsRestock(false, 0)).toBe(true);
    expect(needsRestock(false, 1)).toBe(false);
  });

  it('SHOULD never flag a stock-only item', () => {
    expect(needsRestock(true, 0)).toBe(false);
  });
});

describe('restockQuantity', () => {
  it('SHOULD be ideal - quantity, or 1 without an ideal', () => {
    expect(restockQuantity(0.3, 1)).toBe(0.7);
    expect(restockQuantity(0)).toBe(1);
  });
});
