import { FixedIncomeData } from '@investment/domain/entity/FixedIncomeEntity';
import { operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import {
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
  InvestmentFixedIncomeRateMode,
  InvestmentFixedIncomeRedemptionKind,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { toFixedIncomeView } from './index';

const data: FixedIncomeData = {
  adjustments: [],
  rates: [
    {
      annualRate: '12.0000',
      assetId: 'a',
      cdiPercent: null,
      effectiveRate: '12.000000',
      id: 'r1',
      indexRate: null,
      mode: InvestmentFixedIncomeRateMode.PREFIXED,
      spread: null,
      startDate: '2026-01-02',
    },
  ],
  terms: {
    assetId: 'a',
    liquidity: InvestmentFixedIncomeLiquidity.AT_MATURITY,
    liquidityDate: null,
    maturityDate: '2027-01-04',
    product: InvestmentFixedIncomeProduct.CDB,
    taxExempt: false,
  },
};
const lot = operationFixture({
  date: '2026-01-02',
  id: 'lot-1',
  quantity: Decimal8.parse('10000'),
  total: 1_000_000,
  unitPrice: Decimal8.parse('1'),
});

describe('toFixedIncomeView', () => {
  it('SHOULD be null for an asset without terms', () => {
    expect(toFixedIncomeView(undefined, [lot], '2026-11-10')).toBeNull();
    expect(toFixedIncomeView({ ...data, terms: null }, [lot], '2026-11-10')).toBeNull();
  });

  it('SHOULD compute today, the projection at maturity AND the open lots', () => {
    const view = toFixedIncomeView(data, [lot], '2026-11-10');

    expect(view?.lots).toHaveLength(1);
    expect(view?.lots[0].principal).toBe(1_000_000);
    expect(view?.today.gross).toBeGreaterThan(1_000_000);
    expect(view?.atMaturity.gross).toBeGreaterThan(view?.today.gross ?? 0);
    expect(view?.currentEffectiveRate).toBe('12.000000');
    expect(view?.maturityPending).toBe(false);
  });

  it('SHOULD be pending maturity once the maturity passed with principal left', () => {
    const view = toFixedIncomeView(data, [lot], '2027-02-01');

    expect(view?.maturityPending).toBe(true);
    expect(view?.today.gross).toBe(view?.atMaturity.gross);
  });

  it('SHOULD stop being pending after a total redemption', () => {
    const sell = operationFixture({
      date: '2027-01-04',
      id: 'sell-1',
      netAmount: 1_100_000,
      quantity: Decimal8.parse('0'),
      redemptionKind: InvestmentFixedIncomeRedemptionKind.TOTAL,
      total: 1_100_000,
      type: InvestmentOperationType.SELL,
    });
    const view = toFixedIncomeView(data, [sell, lot], '2027-02-01');

    expect(view?.maturityPending).toBe(false);
    expect(view?.lots).toHaveLength(0);
  });
});
