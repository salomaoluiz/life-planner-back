import { toAssetView } from '@investment/application/service/AssetView';
import { QuoteContext, quoteKey } from '@investment/application/service/QuoteContext';
import {
  assetFixture,
  fixedIncomeDataFixture,
  fixedIncomeTermsFixture,
  listRowFixture,
  operationFixture,
  quoteFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { pickNextMaturity, summarizeHoldings, sumReceivedIncome, toHolding } from './index';

const now = new Date('2026-11-04T18:00:00Z');
const FX = { pair: 'USD-BRL', quotedAt: now, rate: '5.5601', source: 'BRAPI' };

function context(overrides: Partial<QuoteContext> = {}): QuoteContext {
  return { fixedIncome: new Map(), fx: null, now, quotes: new Map(), ...overrides };
}
function fixedIncomeView(name: string, maturityDate: string, ctxBase = context()) {
  const asset = assetFixture({
    assetClass: InvestmentAssetClass.FIXED_INCOME,
    name,
    ticker: null,
  });
  const lot = operationFixture({
    assetId: asset.id,
    date: '2026-01-02',
    quantity: Decimal8.parse('10000'),
    total: 1_000_000,
    unitPrice: Decimal8.parse('1'),
  });
  const data = fixedIncomeDataFixture({
    terms: fixedIncomeTermsFixture({ assetId: asset.id, maturityDate }),
  });

  return toAssetView(listRowFixture({ ...asset, operations: [lot] }), {
    ...ctxBase,
    fixedIncome: new Map([[asset.id, data]]),
  });
}
function stockView(ctx: QuoteContext, quantity = '100') {
  const asset = assetFixture({ ticker: 'ITSA4' });
  const buy = operationFixture({
    assetId: asset.id,
    quantity: Decimal8.parse(quantity),
    total: Number(quantity) * 1000,
    unitPrice: Decimal8.parse('10'),
  });

  return toAssetView(listRowFixture({ ...asset, operations: [buy] }), ctx);
}
const itsaQuotes = new Map([[quoteKey('B3', 'ITSA4'), quoteFixture()]]);

describe('toHolding', () => {
  it('SHOULD value a listed position at the last quote AND carry the quote date', () => {
    const holding = toHolding(stockView(context({ quotes: itsaQuotes })), null);

    expect(holding).toEqual({
      costCents: 100000,
      currentCents: 105300,
      manual: false,
      quotedAt: new Date('2026-11-04T16:00:00Z'),
      stale: false,
      withoutPrice: false,
    });
  });

  it('SHOULD return null WHEN the position is closed', () => {
    const asset = assetFixture();
    const buy = operationFixture({ assetId: asset.id, quantity: Decimal8.parse('10') });
    const sell = operationFixture({
      assetId: asset.id,
      date: '2026-07-01',
      quantity: Decimal8.parse('10'),
      type: InvestmentOperationType.SELL,
    });

    expect(
      toHolding(toAssetView(listRowFixture({ ...asset, operations: [buy, sell] })), null),
    ).toBeNull();
  });

  it('SHOULD flag a manual valuation', () => {
    const asset = assetFixture({ ticker: null });
    const buy = operationFixture({
      assetId: asset.id,
      quantity: Decimal8.parse('2'),
      total: 2000,
      unitPrice: Decimal8.parse('1000'),
    });
    const valuation = valuationFixture({ date: '2026-11-01', unitPrice: Decimal8.parse('1500') });
    const holding = toHolding(
      toAssetView(
        listRowFixture({ ...asset, latestValuation: valuation, operations: [buy] }),
        context(),
      ),
      null,
    );

    expect(holding).toMatchObject({ currentCents: 300000, manual: true, withoutPrice: false });
  });

  it('SHOULD count the position at its cost AND say it has no price WHEN there is no quote or valuation', () => {
    expect(toHolding(stockView(context()), null)).toMatchObject({
      costCents: 100000,
      currentCents: 100000,
      quotedAt: null,
      withoutPrice: true,
    });
  });

  it('SHOULD mark the holding stale WHEN the quote is old', () => {
    const old = quoteFixture({ quotedAt: new Date('2026-10-01T16:00:00Z') });
    const holding = toHolding(
      stockView(context({ quotes: new Map([[quoteKey('B3', 'ITSA4'), old]]) })),
      null,
    );

    expect(holding?.stale).toBe(true);
  });

  it('SHOULD value a calculated title at the estimated net', () => {
    const view = fixedIncomeView('CDB', '2030-01-02');
    const holding = toHolding(view, null);

    expect(holding?.currentCents).toBe(view.fixedIncome?.today.net);
    expect(holding?.costCents).toBe(1_000_000);
    expect(holding?.manual).toBe(false);
  });

  describe('USD assets', () => {
    const aapl = assetFixture({
      assetClass: InvestmentAssetClass.FOREIGN_STOCK,
      currency: 'USD',
      ticker: 'AAPL',
    });
    const buy = operationFixture({
      assetId: aapl.id,
      fxRate: '5.2236',
      quantity: Decimal8.parse('20'),
      total: 364200,
      unitPrice: Decimal8.parse('182.10'),
    });
    const quotes = new Map([
      [
        quoteKey('US', 'AAPL'),
        quoteFixture({
          currency: 'USD',
          market: 'US' as never,
          price: Decimal8.parse('231.4'),
          ticker: 'AAPL',
        }),
      ],
    ]);

    it('SHOULD use the BRL cost at purchase FX AND the value at the current rate', () => {
      const view = toAssetView(
        listRowFixture({ ...aapl, operations: [buy] }),
        context({ fx: FX, quotes }),
      );

      expect(toHolding(view, FX.rate)).toMatchObject({
        costCents: 1902435,
        currentCents: 2573214,
        withoutPrice: false,
      });
    });

    it('SHOULD convert at the current rate WHEN no operation has a rate', () => {
      const view = toAssetView(
        listRowFixture({ ...aapl, operations: [{ ...buy, fxRate: null }] }),
        context({ fx: FX, quotes }),
      );

      expect(toHolding(view, FX.rate)).toMatchObject({ costCents: 2024988, currentCents: 2573214 });
    });

    it('SHOULD not crash AND report no price WHEN there is no rate at all', () => {
      const view = toAssetView(listRowFixture({ ...aapl, operations: [buy] }), context({ quotes }));

      expect(toHolding(view, null)).toMatchObject({
        costCents: 0,
        currentCents: 0,
        withoutPrice: true,
      });
    });
  });
});

describe('summarizeHoldings', () => {
  const base = { manual: false, quotedAt: null, stale: false, withoutPrice: false };

  it('SHOULD sum value and cost AND compute the result in basis points', () => {
    const totals = summarizeHoldings([
      {
        ...base,
        costCents: 10_000_000,
        currentCents: 11_000_000,
        quotedAt: new Date('2026-11-04T19:05:00Z'),
      },
      {
        ...base,
        costCents: 6_290_000,
        currentCents: 7_432_055,
        manual: true,
        quotedAt: new Date('2026-11-03T19:05:00Z'),
      },
    ]);

    expect(totals).toEqual({
      currentValueCents: 18432055,
      investedCents: 16290000,
      manualCount: 1,
      quotesAsOf: new Date('2026-11-03T19:05:00Z'),
      resultBasisPoints: 1315,
      resultCents: 2142055,
      stale: false,
      withoutPrice: 0,
    });
  });

  it('SHOULD return a null percentage AND zeros WHEN there is nothing', () => {
    expect(summarizeHoldings([])).toEqual({
      currentValueCents: 0,
      investedCents: 0,
      manualCount: 0,
      quotesAsOf: null,
      resultBasisPoints: null,
      resultCents: 0,
      stale: false,
      withoutPrice: 0,
    });
  });

  it('SHOULD flag stale AND count assets without price', () => {
    const totals = summarizeHoldings([
      { ...base, costCents: 100, currentCents: 100, stale: true, withoutPrice: true },
      { ...base, costCents: 100, currentCents: 90 },
    ]);

    expect(totals).toMatchObject({ resultBasisPoints: -500, stale: true, withoutPrice: 1 });
  });
});

describe('pickNextMaturity', () => {
  it('SHOULD pick the earliest maturity on or after today', () => {
    const views = [
      fixedIncomeView('Past', '2026-11-01'),
      fixedIncomeView('Later', '2027-03-01'),
      fixedIncomeView('Soon', '2026-12-15'),
    ];

    expect(pickNextMaturity(views, '2026-11-04')).toMatchObject({
      maturityDate: '2026-12-15',
      name: 'Soon',
    });
  });

  it('SHOULD include a title that matures today', () => {
    expect(pickNextMaturity([fixedIncomeView('Today', '2026-11-04')], '2026-11-04')?.name).toBe(
      'Today',
    );
  });

  it('SHOULD break a tie by name', () => {
    const views = [fixedIncomeView('Beta', '2026-12-15'), fixedIncomeView('Alpha', '2026-12-15')];

    expect(pickNextMaturity(views, '2026-11-04')?.name).toBe('Alpha');
  });

  it('SHOULD carry the estimated net at maturity AND the currency', () => {
    const view = fixedIncomeView('CDB', '2026-12-15');

    expect(pickNextMaturity([view], '2026-11-04')).toEqual({
      assetId: view.asset.id,
      currency: 'BRL',
      maturityDate: '2026-12-15',
      name: 'CDB',
      netEstimatedCents: view.fixedIncome?.atMaturity.net,
    });
  });

  it('SHOULD return null WHEN no calculated title is open', () => {
    expect(pickNextMaturity([stockView(context())], '2026-11-04')).toBeNull();
    expect(pickNextMaturity([], '2026-11-04')).toBeNull();
  });
});

describe('sumReceivedIncome', () => {
  it('SHOULD sum BRL as is AND convert USD at the rate', () => {
    expect(
      sumReceivedIncome(
        [
          { currency: 'BRL', netAmount: 100000 },
          { currency: 'USD', netAmount: 1000 },
        ],
        '5.5',
      ),
    ).toEqual({ count: 2, totalCents: 105500 });
  });

  it('SHOULD leave USD out of the total WHEN there is no rate, but still count it', () => {
    expect(sumReceivedIncome([{ currency: 'USD', netAmount: 1000 }], null)).toEqual({
      count: 1,
      totalCents: 0,
    });
  });

  it('SHOULD return zero for no rows', () => {
    expect(sumReceivedIncome([], null)).toEqual({ count: 0, totalCents: 0 });
  });
});
