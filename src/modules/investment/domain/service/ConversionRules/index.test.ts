import { operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { checkAssetPair, operationsAfter } from '@investment/domain/service/ConversionRules';

const reit = { assetClass: InvestmentAssetClass.BR_REIT, currency: 'BRL' };

describe('checkAssetPair', () => {
  it('SHOULD accept two assets of the same class AND currency', () => {
    expect(checkAssetPair(reit, { ...reit })).toBeNull();
  });

  it('SHOULD refuse another class OR another currency', () => {
    expect(checkAssetPair(reit, { ...reit, assetClass: InvestmentAssetClass.BR_STOCK })).toBe(
      'DIFFERENT_CLASS_OR_CURRENCY',
    );
    expect(checkAssetPair(reit, { ...reit, currency: 'USD' })).toBe('DIFFERENT_CLASS_OR_CURRENCY');
  });

  it('SHOULD refuse fixed income on either side', () => {
    const fixed = { assetClass: InvestmentAssetClass.FIXED_INCOME, currency: 'BRL' };

    expect(checkAssetPair(fixed, fixed)).toBe('FIXED_INCOME');
    expect(checkAssetPair(reit, fixed)).toBe('FIXED_INCOME');
  });
});

describe('operationsAfter', () => {
  it('SHOULD list the operations after the date AND skip the ignored ones', () => {
    const before = operationFixture({ date: '2026-10-15' });
    const sell = operationFixture({ date: '2026-10-16', type: InvestmentOperationType.SELL });
    const own = operationFixture({
      date: '2026-10-20',
      type: InvestmentOperationType.CONVERSION_OUT,
    });

    expect(operationsAfter([before, sell, own], '2026-10-15', [own.id])).toEqual([sell]);
  });
});
