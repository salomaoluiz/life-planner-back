import {
  assetFixture,
  listRowFixture,
  operationFixture,
  quoteFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { QuoteContext, quoteKey } from '../QuoteContext';
import { toAssetDetailView, toAssetView } from './index';

const now = new Date('2026-11-04T18:00:00Z');
const itsa = assetFixture({ ticker: 'ITSA4' });
const buy = operationFixture({
  assetId: itsa.id,
  quantity: Decimal8.parse('100'),
  total: 100000,
  unitPrice: Decimal8.parse('10'),
});

function context(overrides: Partial<QuoteContext> = {}): QuoteContext {
  return {
    fixedIncome: new Map(),
    fx: null,
    now,
    quotes: new Map([[quoteKey('B3', 'ITSA4'), quoteFixture()]]),
    ...overrides,
  };
}

describe('toAssetView with a quote (spec 104)', () => {
  it('SHOULD value the position with the automatic quote AND say so', () => {
    const view = toAssetView(listRowFixture({ ...itsa, operations: [buy] }), context());

    expect(view.market.priceSource).toBe('QUOTE');
    expect(view.market.quote).toMatchObject({ price: '10.53', stale: false, ticker: 'ITSA4' });
    expect(view.position.currentUnitPrice?.toString()).toBe('10.53');
    expect(view.position.currentValue).toBe(105300);
    expect(view.position.currentValueDate).toBe('2026-11-04');
    expect(view.market.usd).toBeNull();
    expect(view.market.fx).toBeNull();
  });

  it('SHOULD keep a manual valuation dated on or after the quote date (manual wins)', () => {
    const valuation = valuationFixture({ date: '2026-11-04', unitPrice: Decimal8.parse('4.10') });

    const view = toAssetView(
      listRowFixture({ ...itsa, latestValuation: valuation, operations: [buy] }),
      context(),
    );

    expect(view.market.priceSource).toBe('MANUAL');
    expect(view.position.currentValue).toBe(41000);
    expect(view.market.quote?.price).toBe('10.53');
  });

  it('SHOULD ignore the quote context WHEN the asset has no quoted class or ticker', () => {
    const view = toAssetView(
      listRowFixture({ ...assetFixture({ assetClass: 'PRIVATE' as never, ticker: null }) }),
      context(),
    );

    expect(view.market).toEqual({ fx: null, priceSource: null, quote: null, usd: null });
  });

  it('SHOULD work without a context (no quotes, manual valuation only)', () => {
    const view = toAssetView(
      listRowFixture({
        ...itsa,
        latestValuation: valuationFixture({ date: '2026-10-01', unitPrice: Decimal8.parse('9') }),
        operations: [buy],
      }),
    );

    expect(view.market.priceSource).toBe('MANUAL');
    expect(view.position.currentUnitPrice?.toString()).toBe('9');
  });
});

describe('toAssetDetailView for a USD asset (spec 104 FR 28)', () => {
  const aapl = assetFixture({
    assetClass: 'FOREIGN_STOCK' as never,
    currency: 'USD',
    ticker: 'AAPL',
  });
  const operation = operationFixture({
    assetId: aapl.id,
    fxRate: '5.2236',
    quantity: Decimal8.parse('20'),
    total: 364200,
    unitPrice: Decimal8.parse('182.10'),
  });
  const usContext = context({
    fx: { pair: 'USD-BRL', quotedAt: now, rate: '5.5601', source: 'BRAPI' },
    quotes: new Map([
      [
        quoteKey('US', 'AAPL'),
        quoteFixture({
          currency: 'USD',
          market: 'US' as never,
          price: Decimal8.parse('231.4'),
          ticker: 'AAPL',
        }),
      ],
    ]),
  });

  it('SHOULD split the artifact example into asset move and dollar move', () => {
    const view = toAssetDetailView({ ...aapl, operations: [operation], valuations: [] }, usContext);

    expect(view.position.currentValue).toBe(462800);
    expect(view.position.openResult).toBe(98600);
    expect(view.market.fx?.rate).toBe('5.5601');
    expect(view.market.usd).toMatchObject({
      averageFxRate: '5.2236',
      operationsWithoutFxRate: 0,
      result: { resultBrl: 670779, resultBrlFromAsset: 515047, resultBrlFromFx: 155732 },
    });
  });

  it('SHOULD count operations without a rate AND leave the BRL result out WHEN none has one', () => {
    const view = toAssetDetailView(
      { ...aapl, operations: [{ ...operation, fxRate: null }], valuations: [] },
      usContext,
    );

    expect(view.market.usd).toEqual({
      averageFxRate: null,
      operationsWithoutFxRate: 1,
      result: null,
    });
  });

  it('SHOULD leave the BRL result out WHEN there is no current rate', () => {
    const view = toAssetDetailView(
      { ...aapl, operations: [operation], valuations: [] },
      { ...usContext, fx: null },
    );

    expect(view.market.usd?.result).toBeNull();
    expect(view.market.fx).toBeNull();
  });

  it('SHOULD keep the average after a partial sell', () => {
    const sell = operationFixture({
      assetId: aapl.id,
      createdAt: new Date('2026-02-01T00:00:00Z'),
      date: '2026-06-01',
      quantity: Decimal8.parse('10'),
      total: 200000,
      type: InvestmentOperationType.SELL,
      unitPrice: Decimal8.parse('200'),
    });

    const view = toAssetDetailView(
      { ...aapl, operations: [operation, sell], valuations: [] },
      usContext,
    );

    expect(view.market.usd?.averageFxRate).toBe('5.2236');
    expect(view.operations).toHaveLength(2);
  });
});

describe('toAssetView with a calculated title (spec 105)', () => {
  it('SHOULD value the position with the gross on the curve AND carry the fixed income view', () => {
    const fixed = assetFixture({ assetClass: 'FIXED_INCOME' as never, ticker: null });
    const lot = operationFixture({
      assetId: fixed.id,
      date: '2026-01-02',
      quantity: Decimal8.parse('10000'),
      total: 1_000_000,
      unitPrice: Decimal8.parse('1'),
    });
    const fixedIncome = new Map([
      [
        fixed.id,
        {
          adjustments: [],
          rates: [
            {
              annualRate: '12.0000',
              assetId: fixed.id,
              cdiPercent: null,
              effectiveRate: '12.000000',
              id: 'r1',
              indexRate: null,
              mode: 'PREFIXED' as never,
              spread: null,
              startDate: '2026-01-02',
            },
          ],
          terms: {
            assetId: fixed.id,
            liquidity: 'DAILY' as never,
            liquidityDate: null,
            maturityDate: '2030-01-02',
            product: 'CDB' as never,
            taxExempt: false,
          },
        },
      ],
    ]);

    const view = toAssetView(
      listRowFixture({ ...fixed, operations: [lot] }),
      context({ fixedIncome }),
    );

    expect(view.fixedIncome?.today.gross).toBeGreaterThan(1_000_000);
    expect(view.position.currentValue).toBe(view.fixedIncome?.today.gross);
    expect(view.position.currentUnitPrice).toBeNull();
    expect(view.position.openResult).toBe((view.position.currentValue ?? 0) - 1_000_000);
  });

  it('SHOULD leave fixedIncome null for a manual asset', () => {
    expect(toAssetView(listRowFixture(), context()).fixedIncome).toBeNull();
  });
});

describe('corporate events (spec 108)', () => {
  const mglu = assetFixture({ ticker: 'MGLU3' });
  const bought = operationFixture({
    assetId: mglu.id,
    date: '2026-01-10',
    id: 'buy-1',
    quantity: Decimal8.parse('3155'),
    total: 319100,
  });
  const reverse = operationFixture({
    assetId: mglu.id,
    date: '2026-03-10',
    event: {
      kind: 'SPLIT',
      ratioFrom: Decimal8.parse('10'),
      ratioTo: Decimal8.parse('1'),
    },
    gross: 0,
    id: 'event-1',
    quantity: Decimal8.zero(),
    total: 0,
    type: InvestmentOperationType.REVERSE_SPLIT,
    unitPrice: Decimal8.zero(),
  });

  it('SHOULD apply the event to the position AND list the pending fraction', () => {
    const view = toAssetDetailView({ ...mglu, operations: [bought, reverse], valuations: [] });

    expect(view.position.quantity.toString()).toBe('315');
    expect(view.position.cost).toBe(318594);
    expect(view.position.pendingFractions).toEqual([
      { cost: 506, date: '2026-03-10', eventId: 'event-1', quantity: Decimal8.parse('0.5') },
    ]);
  });

  it('SHOULD give the event row its before and after numbers', () => {
    const view = toAssetDetailView({ ...mglu, operations: [bought, reverse], valuations: [] });
    const row = view.operations.find((item) => item.operation.id === 'event-1');

    expect(row?.event).toMatchObject({
      costAfter: 318594,
      costBefore: 319100,
      fractionCost: 506,
      quantityAfter: Decimal8.parse('315'),
      quantityBefore: Decimal8.parse('3155'),
    });
    expect(view.operations.find((item) => item.operation.id === 'buy-1')?.event).toBeNull();
  });

  it('SHOULD count the pending fractions on the list row', () => {
    const view = toAssetView(listRowFixture({ ...mglu, operations: [bought, reverse] }));

    expect(view.pendingFractionCount).toBe(1);
  });
});
