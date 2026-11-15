import { incomeFixture } from '@investment/domain/entity/mocks/income.fixture';
import {
  assetFixture,
  operationFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { bucketsFor } from '@investment/domain/service/DashboardBuckets';
import { AssetValuationInput } from '@investment/domain/service/PortfolioValuation';
import { Decimal8 } from '@shared/infra/decimal';

import { dashboardTotals, DashboardTotalsInput } from './index';

const TODAY = '2026-11-04';

function assetInput(overrides: Partial<AssetValuationInput> = {}): AssetValuationInput {
  return {
    asset: assetFixture(),
    closes: [{ date: '2026-06-30', price: Decimal8.parse('12') }],
    fixedIncome: null,
    fxHistory: [],
    operations: [
      operationFixture({
        date: '2026-03-10',
        quantity: Decimal8.parse('100'),
        total: 100000,
      }),
    ],
    todayDate: TODAY,
    todayRate: null,
    valuations: [],
    ...overrides,
  };
}
function totalsInput(overrides: Partial<DashboardTotalsInput> = {}): DashboardTotalsInput {
  const from = '2025-12-01';

  return {
    assets: [assetInput()],
    buckets: bucketsFor(from, TODAY),
    from,
    fx: { history: [], todayRate: null },
    incomes: [],
    to: TODAY,
    today: TODAY,
    ...overrides,
  };
}

describe('dashboardTotals', () => {
  it('SHOULD leave the buckets before the first operation empty', () => {
    const { series } = dashboardTotals(totalsInput());

    expect(series[0]).toEqual({ date: '2025-12-31', invested: null, marketValue: null });
    expect(series[series.length - 1]).toEqual({
      date: TODAY,
      invested: 100000,
      marketValue: 120000,
    });
  });

  it('SHOULD build the ranking and the allocation of the open positions', () => {
    const { allocation, ranking, summary } = dashboardTotals(totalsInput());

    expect(ranking).toHaveLength(1);
    expect(ranking[0]).toMatchObject({
      assetId: expect.any(String),
      openResult: 20000,
      share: 1,
      value: 120000,
      valueKind: 'QUOTE',
    });
    expect(allocation).toEqual([
      { assetClass: InvestmentAssetClass.BR_STOCK, share: 1, usd: null, value: 120000 },
    ]);
    expect(summary.currentValue).toBe(120000);
    expect(summary.invested).toBe(100000);
    expect(summary.openResultPercent).toBe(0.2);
  });

  it('SHOULD keep a closed position out of the ranking but count its realized result', () => {
    const closed = assetInput({
      operations: [
        operationFixture({ date: '2026-03-10', quantity: Decimal8.parse('100'), total: 100000 }),
        operationFixture({
          date: '2026-09-01',
          quantity: Decimal8.parse('100'),
          total: 130000,
          type: InvestmentOperationType.SELL,
        }),
      ],
    });
    const { ranking, summary } = dashboardTotals(totalsInput({ assets: [closed] }));

    expect(ranking).toEqual([]);
    expect(summary.realizedResult).toBe(30000);
    expect(summary.salesCount).toBe(1);
  });

  it('SHOULD sum received and planned incomes per bucket, converted at the payment date', () => {
    const foreign = assetInput({
      asset: assetFixture({
        assetClass: InvestmentAssetClass.FOREIGN_STOCK,
        currency: 'USD',
        ticker: 'AAPL',
      }),
      closes: [],
      fxHistory: [
        { date: '2026-10-01', rate: '5' },
        { date: '2026-11-01', rate: '5.2' },
      ],
      todayRate: '5.5',
      valuations: [valuationFixture({ date: '2026-10-01', unitPrice: Decimal8.parse('10') })],
    });
    const { income, summary } = dashboardTotals(
      totalsInput({
        assets: [assetInput(), foreign],
        fx: { history: foreign.fxHistory, todayRate: '5.5' },
        incomes: [
          incomeFixture({ netAmount: 1000, paid: true, paymentDate: '2026-10-15' }),
          incomeFixture({ netAmount: 200, paid: false, paymentDate: '2026-11-30' }),
          incomeFixture({ currency: 'USD', netAmount: 100, paid: true, paymentDate: '2026-10-20' }),
        ],
      }),
    );

    expect(income[income.length - 1].planned).toBe(200);
    expect(summary.incomePlanned).toBe(200);
    // 1000 + US$ 1.00 at the 5.0 rate of its payment date (the 5.2 rate is dated later).
    expect(summary.incomeReceived).toBe(1500);
  });

  it('SHOULD count assets without a price and operations without an FX rate', () => {
    const withoutPrice = assetInput({
      closes: [],
      operations: [
        operationFixture({
          date: '2026-03-10',
          quantity: Decimal8.parse('100'),
          total: 100000,
          unitPrice: Decimal8.parse('0'),
        }),
      ],
    });
    const foreign = assetInput({
      asset: assetFixture({
        assetClass: InvestmentAssetClass.FOREIGN_STOCK,
        currency: 'USD',
        ticker: 'AAPL',
      }),
      closes: [{ date: '2026-06-30', price: Decimal8.parse('10') }],
      fxHistory: [{ date: '2026-03-10', rate: '5' }],
      operations: [
        operationFixture({
          date: '2026-03-10',
          quantity: Decimal8.parse('10'),
          total: 10000,
        }),
      ],
      todayRate: '5',
    });
    const { summary } = dashboardTotals(totalsInput({ assets: [withoutPrice, foreign] }));

    expect(summary.assetsWithoutValue).toBe(1);
    expect(summary.operationsWithoutFxRate).toBe(1);
  });
});
