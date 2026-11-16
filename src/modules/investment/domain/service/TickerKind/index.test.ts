import { InvestmentAssetClass } from '@investment/domain/enum';

import { classOfTickerKind } from './index';

describe('classOfTickerKind', () => {
  it.each(['STOCK', 'ETF', 'BDR'] as const)('SHOULD require BR_STOCK for %s', (kind) => {
    expect(classOfTickerKind(kind)).toBe(InvestmentAssetClass.BR_STOCK);
  });

  it('SHOULD require BR_REIT for REIT', () => {
    expect(classOfTickerKind('REIT')).toBe(InvestmentAssetClass.BR_REIT);
  });

  it.each(['FIAGRO', 'UNKNOWN'] as const)('SHOULD require nothing for %s', (kind) => {
    expect(classOfTickerKind(kind)).toBeNull();
  });
});
