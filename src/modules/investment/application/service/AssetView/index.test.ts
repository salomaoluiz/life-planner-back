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
