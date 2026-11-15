import { ForbiddenException } from '@nestjs/common';

import {
  assetFixture,
  operationFixture,
  quoteFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { Decimal8 } from '@shared/infra/decimal';

import { incomeSpies, mocks, quoteSpies, setup, spies } from './index.mocks';

const input = {
  accessibleOwners: mocks.owners,
  from: mocks.period.from,
  ownerIds: ['user-1'],
  to: mocks.period.to,
  today: mocks.period.today,
};

function stockDetail() {
  const asset = assetFixture({ id: 'asset-1', ticker: 'ITSA4' });

  return {
    ...asset,
    operations: [
      operationFixture({
        assetId: 'asset-1',
        date: '2026-03-10',
        quantity: Decimal8.parse('100'),
        total: 100000,
      }),
    ],
    valuations: [],
  };
}

describe('GetInvestmentsDashboardUseCase', () => {
  it('SHOULD reject an owner the user cannot read', async () => {
    await expect(setup.execute({ ...input, ownerIds: ['other'] })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('SHOULD answer an empty dashboard WHEN the owners have no asset', async () => {
    const result = await setup.execute(input);

    expect(result.period).toEqual({ bucket: 'MONTH', from: input.from, to: input.to });
    expect(result.summary.currentValue).toBe(0);
    expect(result.summary.invested).toBe(0);
    expect(result.ranking).toEqual([]);
    expect(result.series.every((point) => point.marketValue === null)).toBe(true);
    expect(quoteSpies.findHistories).not.toHaveBeenCalled();
  });

  it('SHOULD value the positions from the stored closes and count the stale quotes', async () => {
    spies.findAssetDetailsByOwners.mockResolvedValue([stockDetail()]);
    quoteSpies.findHistories.mockResolvedValue([
      {
        close: Decimal8.parse('12'),
        date: '2026-06-30',
        market: QuoteMarket.B3,
        source: 'BRAPI' as never,
        ticker: 'ITSA4',
      },
    ]);
    quoteSpies.findQuotes.mockResolvedValue([
      {
        ...quoteFixture({ ticker: 'ITSA4' }),
        lastErrorAt: null,
        market: QuoteMarket.B3,
        quotedAt: new Date('2026-06-30T16:00:00Z'),
      },
    ]);

    const result = await setup.execute(input);

    expect(result.summary.currentValue).toBe(120000);
    expect(result.summary.invested).toBe(100000);
    expect(result.summary.historyStartsAt).toBe('2026-06-30');
    expect(result.ranking).toHaveLength(1);
    expect(result.summary.staleQuotes).toBe(1);
    expect(spies.findAssetDetailsByOwners).toHaveBeenCalledTimes(1);
    expect(quoteSpies.findHistories).toHaveBeenCalledTimes(1);
    expect(incomeSpies.findPeriodIncomes).toHaveBeenCalledTimes(1);
  });

  it('SHOULD read the FX data and the fixed income rows only when they are needed', async () => {
    const asset = assetFixture({
      assetClass: InvestmentAssetClass.FOREIGN_STOCK,
      currency: 'USD',
      id: 'asset-2',
      ticker: 'AAPL',
    });
    spies.findAssetDetailsByOwners.mockResolvedValue([
      {
        ...asset,
        operations: [
          operationFixture({
            assetId: 'asset-2',
            date: '2026-01-05',
            fxRate: '5.2236',
            quantity: Decimal8.parse('20'),
            total: 364200,
            unitPrice: Decimal8.parse('182.10'),
          }),
        ],
        valuations: [
          valuationFixture({
            assetId: 'asset-2',
            date: '2026-02-01',
            unitPrice: Decimal8.parse('200'),
          }),
        ],
      },
    ]);
    quoteSpies.findFx.mockResolvedValue({
      pair: 'USD-BRL',
      quotedAt: new Date('2026-11-04T18:00:00Z'),
      rate: '5.5601',
      source: 'BRAPI',
    });
    quoteSpies.findFxHistory.mockResolvedValue([
      { date: '2026-01-05', pair: 'USD-BRL', rate: '5.2236', source: 'BRAPI' },
    ] as never);
    quoteSpies.findHistories.mockResolvedValue([]);

    const result = await setup.execute(input);

    expect(quoteSpies.findFx).toHaveBeenCalledTimes(1);
    expect(quoteSpies.findHistories).toHaveBeenCalledWith(
      [{ market: QuoteMarket.US, ticker: 'AAPL' }],
      '2026-01-05',
      input.to,
    );
    expect(result.summary.operationsWithoutFxRate).toBe(0);
    expect(result.ranking[0].usdValue).toBe('4000');
    expect(spies.findFixedIncomeByAssetIds).not.toHaveBeenCalled();
  });
});
