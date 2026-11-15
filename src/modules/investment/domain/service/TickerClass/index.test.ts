import { InvestmentAssetClass } from '@investment/domain/enum';
import { B3TickerKind } from '@shared/infra/quotes/types';

import { classOfTickerKind } from './index';

describe('classOfTickerKind', () => {
  it.each<[B3TickerKind, InvestmentAssetClass | null]>([
    ['STOCK', InvestmentAssetClass.BR_STOCK],
    ['ETF', InvestmentAssetClass.BR_STOCK],
    ['BDR', InvestmentAssetClass.BR_STOCK],
    ['REIT', InvestmentAssetClass.BR_REIT],
    ['FIAGRO', null],
    ['UNKNOWN', null],
  ])('SHOULD answer the class of %s', (kind, expected) => {
    expect(classOfTickerKind(kind)).toBe(expected);
  });
});
