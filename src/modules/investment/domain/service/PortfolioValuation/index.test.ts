import {
  assetFixture,
  fixedIncomeDataFixture,
  operationFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { AssetValuationInput, realizedInPeriod, snapshotAt } from './index';

function input(overrides: Partial<AssetValuationInput> = {}): AssetValuationInput {
  return {
    asset: assetFixture(),
    closes: [],
    fixedIncome: null,
    fxHistory: [],
    operations: [],
    todayDate: '2026-11-04',
    todayRate: null,
    valuations: [],
    ...overrides,
  };
}
const buy = (overrides: Parameters<typeof operationFixture>[0] = {}) =>
  operationFixture({ date: '2026-03-10', quantity: Decimal8.parse('100'), total: 100000, ...overrides });

describe('snapshotAt', () => {
  it('SHOULD price a BRL stock at the latest close', () => {
    const snapshot = snapshotAt(
      input({
        closes: [{ date: '2026-06-30', price: Decimal8.parse('12') }],
        operations: [buy()],
      }),
      '2026-06-30',
    );

    expect(snapshot?.costCents).toBe(100000);
    expect(snapshot?.valueCents).toBe(120000);
    expect(snapshot?.openResult).toBe(20000);
    expect(snapshot?.openResultPercent).toBe(0.2);
    expect(snapshot?.valueKind).toBe('QUOTE');
  });

  it('SHOULD return null before the first operation and for a closed position', () => {
    expect(snapshotAt(input({ operations: [buy()] }), '2026-03-09')).toBeNull();

    const sell = operationFixture({
      date: '2026-05-02',
      quantity: Decimal8.parse('100'),
      total: 110000,
      type: InvestmentOperationType.SELL,
    });

    expect(snapshotAt(input({ operations: [buy(), sell] }), '2026-05-02')).toBeNull();
  });

  it('SHOULD fall back to the last valuation, then to the operation price, then to the cost', () => {
    const manual = snapshotAt(
      input({
        operations: [buy()],
        valuations: [valuationFixture({ date: '2026-04-01', unitPrice: Decimal8.parse('11') })],
      }),
      '2026-05-01',
    );
    const operationPrice = snapshotAt(input({ operations: [buy()] }), '2026-04-01');
    const cost = snapshotAt(input({ operations: [buy({ unitPrice: Decimal8.parse('10') })] }), '2026-04-01');
    const noPrice = snapshotAt(
      input({ operations: [buy({ unitPrice: Decimal8.parse('0') })] }),
      '2026-04-01',
    );

    expect(manual?.valueCents).toBe(110000);
    expect(manual?.valueKind).toBe('MANUAL');
    expect(operationPrice?.valueCents).toBe(102000);
    expect(cost?.valueCents).toBe(100000);
    expect(noPrice?.valueCents).toBe(noPrice?.costCents);
  });

  it('SHOULD value a foreign stock with the rate of the date and split the result', () => {
    const asset = assetFixture({
      assetClass: InvestmentAssetClass.FOREIGN_STOCK,
      currency: 'USD',
      ticker: 'AAPL',
    });
    const snapshot = snapshotAt(
      input({
        asset,
        closes: [{ date: '2026-11-04', price: Decimal8.parse('231.40') }],
        fxHistory: [{ date: '2025-11-04', rate: '5.2236' }],
        operations: [
          operationFixture({
            date: '2025-11-04',
            fxRate: '5.2236',
            quantity: Decimal8.parse('20'),
            total: 364200,
            unitPrice: Decimal8.parse('182.10'),
          }),
        ],
        todayRate: '5.5601',
      }),
      '2026-11-04',
    );

    expect(snapshot?.usd?.marketValueUsd).toBe(462800);
    expect(snapshot?.usd?.resultFromAsset).toBe(515047);
    expect(snapshot?.usd?.resultFromFx).toBe(155732);
    expect(snapshot?.valueCents).toBe(2573214);
  });

  it('SHOULD count a calculated fixed income at its estimated net', () => {
    const asset = assetFixture({
      assetClass: InvestmentAssetClass.FIXED_INCOME,
      ticker: null,
    });
    const snapshot = snapshotAt(
      input({
        asset,
        fixedIncome: fixedIncomeDataFixture(),
        operations: [
          operationFixture({
            date: '2026-01-02',
            quantity: Decimal8.parse('10000'),
            total: 1000000,
            unitPrice: Decimal8.parse('1'),
          }),
        ],
      }),
      '2026-11-04',
    );

    expect(snapshot?.valueKind).toBe('FIXED_INCOME_NET');
    expect(snapshot?.valueCents).toBeGreaterThan(1000000);
    expect(snapshot?.valueCents).toBeLessThan(1100000);
    expect(snapshot?.openResult).toBe(snapshot!.valueCents - snapshot!.costCents);
  });

  it('SHOULD use the close of the date, not a later one', () => {
    const snapshot = snapshotAt(
      input({
        closes: [
          { date: '2026-06-30', price: Decimal8.parse('12') },
          { date: '2026-07-31', price: Decimal8.parse('15') },
        ],
        operations: [buy()],
      }),
      '2026-06-30',
    );

    expect(snapshot?.valueCents).toBe(120000);
  });
});

describe('realizedInPeriod', () => {
  it('SHOULD sum only the sells dated in the period', () => {
    const operations = [
      buy(),
      operationFixture({
        date: '2026-04-01',
        quantity: Decimal8.parse('50'),
        total: 60000,
        type: InvestmentOperationType.SELL,
      }),
      operationFixture({
        date: '2026-08-01',
        quantity: Decimal8.parse('50'),
        total: 70000,
        type: InvestmentOperationType.SELL,
      }),
    ];

    expect(realizedInPeriod(input({ operations }), '2026-04-01', '2026-06-30')).toBe(10000);
    expect(realizedInPeriod(input({ operations }), '2026-01-01', '2026-12-31')).toBe(30000);
  });
});
