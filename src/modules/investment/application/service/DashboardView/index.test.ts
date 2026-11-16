import { emptyContext, QuoteContext, quoteKey } from '@investment/application/service/QuoteContext';
import {
  assetFixture,
  listRowFixture,
  operationFixture,
  quoteFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import {
  InvestmentAssetClass,
  InvestmentIncomeType,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { QuoteMarket, QuoteSource } from '@investment/domain/enum/QuoteMarket';
import { Decimal8 } from '@shared/infra/decimal';

import { buildDashboard, DashboardData } from './index';

const FROM = '2025-12-01';
const TO = '2026-11-04';
const NOW = new Date('2026-11-04T18:00:00Z');

function buy(
  assetId: string,
  date: string,
  quantity: string,
  unitPrice: string,
  total: number,
  extra = {},
) {
  return operationFixture({
    assetId,
    date,
    gross: total,
    quantity: Decimal8.parse(quantity),
    total,
    type: InvestmentOperationType.BUY,
    unitPrice: Decimal8.parse(unitPrice),
    ...extra,
  });
}
function close(market: QuoteMarket, ticker: string, date: string, value: string) {
  return { close: Decimal8.parse(value), date, market, source: QuoteSource.BRAPI, ticker };
}
function income(
  assetId: string,
  paymentDate: string,
  netAmount: number,
  paid: boolean,
  extra = {},
) {
  return {
    assetId,
    currency: 'BRL',
    netAmount,
    paid,
    paymentDate,
    type: InvestmentIncomeType.JCP,
    ...extra,
  };
}
const itsa = assetFixture({ id: 'itsa', name: 'Itausa PN', ticker: 'ITSA4' });
const aapl = assetFixture({
  assetClass: InvestmentAssetClass.FOREIGN_STOCK,
  currency: 'USD',
  id: 'aapl',
  name: 'Apple Inc.',
  ticker: 'AAPL',
});

function data(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    closes: [
      close(QuoteMarket.B3, 'ITSA4', '2026-06-30', '12'),
      close(QuoteMarket.B3, 'ITSA4', '2026-11-04', '13'),
      close(QuoteMarket.US, 'AAPL', '2026-11-04', '231.40'),
    ],
    context: emptyContext(NOW),
    from: FROM,
    // The use case appends the current quote to the history, so the curve ends at today.
    fx: {
      current: '5.5601',
      rates: [
        { date: '2025-11-10', rate: '5.0000' },
        { date: '2026-11-04', rate: '5.5601' },
      ],
    },
    incomes: [],
    rows: [
      listRowFixture({ ...itsa, operations: [buy('itsa', '2026-03-10', '100', '10', 100_000)] }),
      listRowFixture({
        ...aapl,
        operations: [buy('aapl', '2025-11-10', '20', '182.10', 364_200, { fxRate: '5.2236' })],
      }),
    ],
    to: TO,
    today: TO,
    valuations: new Map(),
    ...overrides,
  };
}
function onlyStock(overrides: Partial<DashboardData> = {}) {
  return data({
    closes: [close(QuoteMarket.B3, 'ITSA4', '2026-06-30', '12')],
    rows: [
      listRowFixture({ ...itsa, operations: [buy('itsa', '2026-03-10', '100', '10', 100_000)] }),
    ],
    ...overrides,
  });
}

describe('buildDashboard', () => {
  describe('series', () => {
    it('SHOULD give a monthly point per bucket, the last one at the period end', () => {
      const { period, series } = buildDashboard(onlyStock());

      expect(period).toEqual({ bucket: 'MONTH', from: FROM, to: TO });
      expect(series).toHaveLength(12);
      expect(series[0]?.date).toBe('2025-12-31');
      expect(series[11]?.date).toBe(TO);
    });

    it('SHOULD leave the buckets before the first operation null, not zero', () => {
      const { series } = buildDashboard(onlyStock());

      expect(series.slice(0, 3)).toEqual([
        { date: '2025-12-31', invested: null, marketValue: null },
        { date: '2026-01-31', invested: null, marketValue: null },
        { date: '2026-02-28', invested: null, marketValue: null },
      ]);
    });

    it('SHOULD show invested R$ 1.000,00 AND market value R$ 1.200,00 in June, the operation price in March', () => {
      const { series } = buildDashboard(onlyStock());

      expect(series.find((point) => point.date === '2026-03-31')).toMatchObject({
        invested: 100_000,
        marketValue: 100_000,
      });
      expect(series.find((point) => point.date === '2026-06-30')).toMatchObject({
        invested: 100_000,
        marketValue: 120_000,
      });
    });
  });

  describe('summary', () => {
    it('SHOULD consolidate current value, invested AND open result in BRL at the period end', () => {
      const { summary } = buildDashboard(data());

      expect(summary).toMatchObject({
        currentValue: 2_703_214,
        invested: 2_002_435,
        openResult: 700_779,
        openResultPercent: 0.35,
      });
    });

    it('SHOULD give a null percent WHEN nothing is invested', () => {
      const { summary } = buildDashboard(data({ rows: [] }));

      expect(summary).toMatchObject({ currentValue: 0, invested: 0, openResultPercent: null });
    });

    it('SHOULD sum only the sales dated in the period AND count them', () => {
      const row = listRowFixture({
        ...itsa,
        operations: [
          buy('itsa', '2026-03-10', '100', '10', 100_000),
          buy('itsa', '2026-06-10', '0', '12', 48_000, {
            quantity: Decimal8.parse('40'),
            type: InvestmentOperationType.SELL,
          }),
        ],
      });
      const { summary } = buildDashboard(onlyStock({ rows: [row] }));

      expect(summary).toMatchObject({ realizedResult: 8_000, salesCount: 1 });
    });

    it('SHOULD flag assets whose quote is stale AND the history start of the latest asset', () => {
      const context: QuoteContext = {
        ...emptyContext(NOW),
        quotes: new Map([
          [
            quoteKey('B3', 'ITSA4'),
            quoteFixture({ quotedAt: new Date('2026-10-20T20:00:00Z'), ticker: 'ITSA4' }),
          ],
        ]),
      };
      const { summary } = buildDashboard(data({ context }));

      expect(summary.staleQuotes).toBe(1);
      // ITSA4 first close 2026-06-30, AAPL first close 2026-11-04: the latest one is the point
      // after which every price is a close (before it, some come from the operations).
      expect(summary.historyStartsAt).toBe('2026-11-04');
    });

    it('SHOULD not report a history start WHEN every asset has a close on or before the period start', () => {
      const closes = [
        close(QuoteMarket.B3, 'ITSA4', '2025-11-28', '9'),
        close(QuoteMarket.B3, 'ITSA4', '2026-06-30', '12'),
      ];

      expect(buildDashboard(onlyStock({ closes })).summary.historyStartsAt).toBeNull();
    });
  });

  describe('allocation', () => {
    it('SHOULD split by class in the spec order, hide empty classes AND carry the USD detail', () => {
      const { allocation } = buildDashboard(data());

      expect(allocation.map((slice) => slice.assetClass)).toEqual(['BR_STOCK', 'FOREIGN_STOCK']);
      expect(allocation[0]).toMatchObject({ share: 0.0481, value: 130_000 });
      expect(allocation[0]).not.toHaveProperty('usd');
      expect(allocation[1]).toMatchObject({
        share: 0.9519,
        usd: {
          fxRate: '5.5601',
          resultFromAsset: 515_047,
          resultFromFx: 155_732,
          value: '4628.00',
        },
        value: 2_573_214,
      });
    });
  });

  describe('ranking', () => {
    it('SHOULD list open positions by value desc with share, result AND the USD second value', () => {
      const { ranking } = buildDashboard(data());

      expect(ranking.map((row) => row.ticker)).toEqual(['AAPL', 'ITSA4']);
      expect(ranking[0]).toMatchObject({
        assetClass: 'FOREIGN_STOCK',
        assetId: 'aapl',
        openResult: 670_779,
        openResultPercent: 0.3526,
        share: 0.9519,
        usdValue: '4628.00',
        value: 2_573_214,
        valueKind: 'QUOTE',
      });
      expect(ranking[1]).not.toHaveProperty('usdValue');
    });

    it('SHOULD leave a closed position out of the ranking AND the allocation', () => {
      const closed = listRowFixture({
        ...itsa,
        operations: [
          buy('itsa', '2026-03-10', '100', '10', 100_000),
          buy('itsa', '2026-06-10', '100', '12', 120_000, { type: InvestmentOperationType.SELL }),
        ],
      });
      const result = buildDashboard(onlyStock({ rows: [closed] }));

      expect(result.ranking).toEqual([]);
      expect(result.allocation).toEqual([]);
      expect(result.summary.realizedResult).toBe(20_000);
    });
  });

  describe('incomes', () => {
    it('SHOULD split received AND planned per bucket, the last bucket reaching the end of its month', () => {
      const { incomes, summary } = buildDashboard(
        data({
          incomes: [
            income('itsa', '2026-10-30', 7_140, true),
            income('itsa', '2026-11-20', 3_000, false, { type: InvestmentIncomeType.DIVIDEND }),
          ],
        }),
      );

      expect(incomes).toHaveLength(12);
      expect(incomes[10]).toMatchObject({ date: '2026-10-31', planned: 0, received: 7_140 });
      expect(incomes[11]).toMatchObject({ date: '2026-11-30', planned: 3_000, received: 0 });
      expect(incomes[11]?.byType).toEqual({ DIVIDEND: 1, INTEREST: 0, JCP: 0, OTHER: 0, YIELD: 0 });
      expect(summary).toMatchObject({ incomePlanned: 3_000, incomeReceived: 7_140 });
    });

    it('SHOULD convert a USD income at the rate of its payment date', () => {
      const { summary } = buildDashboard(
        data({ incomes: [income('aapl', '2026-09-10', 500, true, { currency: 'USD' })] }),
      );

      // 5.00 USD × 5.0000 (the rate on the payment date)
      expect(summary.incomeReceived).toBe(2_500);
    });

    it('SHOULD not extend the last bucket WHEN the period does not end today', () => {
      const { incomes } = buildDashboard(
        data({ from: '2025-01-01', incomes: [], to: '2025-12-31', today: TO }),
      );

      expect(incomes[incomes.length - 1]?.date).toBe('2025-12-31');
    });
  });

  it('SHOULD answer empty blocks AND null points WHEN the owners have no assets', () => {
    const result = buildDashboard(data({ rows: [] }));

    expect(result.ranking).toEqual([]);
    expect(result.allocation).toEqual([]);
    expect(result.series.every((point) => point.marketValue === null)).toBe(true);
  });

  it('SHOULD count an asset without a usable price AND an operation without a rate', () => {
    const noRate = data({
      fx: { current: '5.5601', rates: [] },
      rows: [
        listRowFixture({
          ...aapl,
          operations: [buy('aapl', '2025-11-10', '20', '182.10', 364_200, { fxRate: null })],
        }),
      ],
    });

    expect(buildDashboard(noRate).summary.operationsWithoutFxRate).toBe(1);
  });
});
