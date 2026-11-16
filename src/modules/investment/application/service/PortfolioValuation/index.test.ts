import {
  assetFixture,
  fixedIncomeDataFixture,
  operationFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { toFixedIncomeView } from '../FixedIncomeView';
import { FxCurve, realizedInPeriod, ValuationInput, valueAssetAt } from './index';

const NO_FX: FxCurve = { current: null, rates: [] };
const ASSET = assetFixture({ id: 'asset-1' });

function buy(date: string, quantity: string, unitPrice: string, total: number, extra = {}) {
  return operationFixture({
    assetId: 'asset-1',
    date,
    gross: total,
    quantity: Decimal8.parse(quantity),
    total,
    type: InvestmentOperationType.BUY,
    unitPrice: Decimal8.parse(unitPrice),
    ...extra,
  });
}
function input(overrides: Partial<ValuationInput> = {}): ValuationInput {
  return {
    asset: ASSET,
    closes: [{ close: Decimal8.parse('12'), date: '2026-06-30' }],
    fixedIncome: undefined,
    operations: [buy('2026-03-10', '100', '10', 100_500)],
    valuations: [],
    ...overrides,
  };
}
function sell(date: string, quantity: string, unitPrice: string, total: number, extra = {}) {
  return buy(date, quantity, unitPrice, total, { type: InvestmentOperationType.SELL, ...extra });
}

describe('valueAssetAt', () => {
  it('SHOULD value a BRL stock at the close of the date AND count its cost with fees', () => {
    const value = valueAssetAt(input(), '2026-06-30', NO_FX);

    expect(value).toMatchObject({
      costBrl: 100_500,
      quantityZero: false,
      valueBrl: 120_000,
      valueKind: 'QUOTE',
    });
  });

  it('SHOULD report no position BEFORE the first operation', () => {
    expect(valueAssetAt(input(), '2026-02-28', NO_FX)).toMatchObject({
      costBrl: 0,
      quantityZero: true,
      valueBrl: 0,
    });
  });

  it('SHOULD fall back to the operation price, never to zero, WHEN no close exists before the date', () => {
    const value = valueAssetAt(input(), '2026-05-31', NO_FX);

    expect(value.valueBrl).toBe(100_000);
    expect(value.valueKind).toBe('QUOTE');
  });

  it('SHOULD prefer a manual valuation dated on or after the latest close', () => {
    const value = valueAssetAt(
      input({
        valuations: [valuationFixture({ date: '2026-07-10', unitPrice: Decimal8.parse('13') })],
      }),
      '2026-07-15',
      NO_FX,
    );

    expect(value).toMatchObject({ valueBrl: 130_000, valueKind: 'MANUAL' });
  });

  it('SHOULD ignore a manual valuation dated after the date asked', () => {
    const value = valueAssetAt(
      input({
        valuations: [valuationFixture({ date: '2026-07-10', unitPrice: Decimal8.parse('13') })],
      }),
      '2026-06-30',
      NO_FX,
    );

    expect(value).toMatchObject({ valueBrl: 120_000, valueKind: 'QUOTE' });
  });

  it('SHOULD use the latest valuation of an unlisted asset AND its operation price before any', () => {
    const asset = assetFixture({
      assetClass: InvestmentAssetClass.PRIVATE,
      id: 'asset-1',
      ticker: null,
    });
    const base = input({
      asset,
      closes: [],
      valuations: [valuationFixture({ date: '2026-05-01', unitPrice: Decimal8.parse('11') })],
    });

    expect(valueAssetAt(base, '2026-06-01', NO_FX)).toMatchObject({
      valueBrl: 110_000,
      valueKind: 'MANUAL',
    });
    expect(valueAssetAt(base, '2026-04-01', NO_FX)).toMatchObject({
      valueBrl: 100_000,
      valueKind: 'MANUAL',
    });
  });

  it('SHOULD change the quantity only from the date of a split', () => {
    const split = operationFixture({
      assetId: 'asset-1',
      date: '2026-05-01',
      event: { kind: 'SPLIT', ratioFrom: Decimal8.parse('1'), ratioTo: Decimal8.parse('2') },
      gross: 0,
      quantity: Decimal8.zero(),
      total: 0,
      type: InvestmentOperationType.SPLIT,
    });
    const base = input({
      closes: [
        { close: Decimal8.parse('10'), date: '2026-04-30' },
        { close: Decimal8.parse('5'), date: '2026-06-01' },
      ],
      operations: [buy('2026-03-10', '100', '10', 100_000), split],
    });

    expect(valueAssetAt(base, '2026-04-30', NO_FX).valueBrl).toBe(100_000);
    expect(valueAssetAt(base, '2026-06-01', NO_FX).valueBrl).toBe(100_000);
    expect(valueAssetAt(base, '2026-06-01', NO_FX).costBrl).toBe(100_000);
  });

  it('SHOULD return an empty value for a closed position', () => {
    const value = valueAssetAt(
      input({
        operations: [
          buy('2026-03-10', '100', '10', 100_000),
          sell('2026-06-10', '100', '12', 120_000),
        ],
      }),
      '2026-06-30',
      NO_FX,
    );

    expect(value).toMatchObject({ costBrl: 0, quantityZero: true, valueBrl: 0 });
  });

  describe('USD assets', () => {
    const usdAsset = assetFixture({
      assetClass: InvestmentAssetClass.FOREIGN_STOCK,
      currency: 'USD',
      id: 'asset-1',
      ticker: 'AAPL',
    });
    function usd(fxRate: null | string) {
      return input({
        asset: usdAsset,
        closes: [{ close: Decimal8.parse('231.40'), date: '2026-11-04' }],
        operations: [buy('2025-11-10', '20', '182.10', 364_200, { fxRate })],
      });
    }
    const curve: FxCurve = {
      current: '5.5601',
      rates: [
        { date: '2026-06-30', rate: '5.0000' },
        { date: '2026-11-04', rate: '5.5601' },
      ],
    };

    it('SHOULD value with the rate of the date AND the cost with the average rate', () => {
      const value = valueAssetAt(usd('5.2236'), '2026-11-04', curve);

      expect(value).toMatchObject({
        costBrl: 1_902_435,
        operationsWithoutFxRate: 0,
        usd: {
          costUsd: 364_200,
          fxRate: '5.5601',
          resultFromAsset: 515_047,
          resultFromFx: 155_732,
          valueUsd: 462_800,
        },
        valueBrl: 2_573_214,
      });
    });

    it('SHOULD use the rate of a past date, not the current one', () => {
      const past = input({
        ...usd('5.2236'),
        closes: [{ close: Decimal8.parse('200'), date: '2026-06-30' }],
      });
      const value = valueAssetAt(past, '2026-07-15', curve);

      expect(value.usd?.fxRate).toBe('5.0000');
      expect(value.valueBrl).toBe(2_000_000);
    });

    it('SHOULD rate an operation without fx_rate with the curve of its date AND count it', () => {
      const withCurve: FxCurve = {
        current: '5.5601',
        rates: [{ date: '2025-11-10', rate: '5.0000' }, ...curve.rates],
      };
      const value = valueAssetAt(usd(null), '2026-11-04', withCurve);

      expect(value.operationsWithoutFxRate).toBe(1);
      expect(value.costBrl).toBe(1_821_000);
    });

    it('SHOULD flag the asset instead of inventing a number WHEN there is no rate at all', () => {
      const value = valueAssetAt(usd(null), '2026-11-04', NO_FX);

      expect(value).toMatchObject({ costBrl: 0, missingFx: true, valueBrl: 0 });
    });
  });

  describe('calculated fixed income', () => {
    const asset = assetFixture({
      assetClass: InvestmentAssetClass.FIXED_INCOME,
      id: 'asset-fi',
      ticker: null,
    });
    const lot = operationFixture({
      assetId: 'asset-fi',
      date: '2026-01-02',
      gross: 1_000_000,
      quantity: Decimal8.parse('10000'),
      total: 1_000_000,
      type: InvestmentOperationType.BUY,
      unitPrice: Decimal8.parse('1'),
    });
    const data = fixedIncomeDataFixture();

    it('SHOULD count the estimated net of the date, never the gross or the principal', () => {
      const on = '2026-07-01';
      const view = toFixedIncomeView(data, [lot], on);
      const value = valueAssetAt(
        { asset, closes: [], fixedIncome: data, operations: [lot], valuations: [] },
        on,
        NO_FX,
      );

      expect(value.valueKind).toBe('FIXED_INCOME_NET');
      expect(value.valueBrl).toBe(view?.today.net);
      expect(value.valueBrl).toBeLessThan(view?.today.gross ?? 0);
      expect(value.valueBrl).toBeGreaterThan(1_000_000);
      expect(value.costBrl).toBe(1_000_000);
    });

    it('SHOULD value a different net at each date', () => {
      const base = { asset, closes: [], fixedIncome: data, operations: [lot], valuations: [] };

      expect(valueAssetAt(base, '2026-10-01', NO_FX).valueBrl).toBeGreaterThan(
        valueAssetAt(base, '2026-04-01', NO_FX).valueBrl,
      );
    });
  });
});

describe('realizedInPeriod', () => {
  const operations = [
    buy('2026-03-10', '100', '10', 100_000),
    sell('2026-06-10', '40', '12', 48_000),
    sell('2026-08-01', '10', '15', 15_000),
  ];

  it('SHOULD sum only the sales dated in the period', () => {
    expect(realizedInPeriod(input({ operations }), '2026-06-01', '2026-06-30', NO_FX)).toEqual({
      cents: 8_000,
      sales: 1,
    });
  });

  it('SHOULD give zero for a period without sales', () => {
    expect(realizedInPeriod(input({ operations }), '2026-04-01', '2026-04-30', NO_FX)).toEqual({
      cents: 0,
      sales: 0,
    });
  });

  it('SHOULD convert the result of a USD sale at the rate of the operation', () => {
    const usdAsset = assetFixture({
      assetClass: InvestmentAssetClass.FOREIGN_STOCK,
      currency: 'USD',
      id: 'asset-1',
      ticker: 'AAPL',
    });
    const usd = input({
      asset: usdAsset,
      operations: [
        buy('2026-03-10', '100', '10', 100_000, { fxRate: '5.0000' }),
        sell('2026-06-10', '40', '12', 48_000, { fxRate: '5.0000' }),
      ],
    });

    expect(realizedInPeriod(usd, '2026-06-01', '2026-06-30', NO_FX).cents).toBe(40_000);
  });

  it('SHOULD keep the sign of a loss', () => {
    const loss = [buy('2026-03-10', '100', '10', 100_000), sell('2026-06-10', '100', '9', 90_000)];

    expect(
      realizedInPeriod(input({ operations: loss }), '2026-06-01', '2026-06-30', NO_FX).cents,
    ).toBe(-10_000);
  });
});
