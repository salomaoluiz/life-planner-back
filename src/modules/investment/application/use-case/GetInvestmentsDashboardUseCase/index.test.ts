import { ForbiddenException } from '@nestjs/common';

import { emptyContext, QuoteContext } from '@investment/application/service/QuoteContext';
import {
  assetFixture,
  listRowFixture,
  operationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { Decimal8 } from '@shared/infra/decimal';

import { incomeSpies, loadSpy, mocks, quoteRepoSpies, setup, spies } from './index.mocks';

const input = {
  accessibleOwners: mocks.owners,
  from: '2025-12-01',
  ownerIds: ['user-1'],
  to: '2026-11-04',
  today: mocks.today,
};
const now = new Date('2026-11-04T18:00:00Z');

function loaded(overrides: Partial<QuoteContext> = {}) {
  loadSpy.mockResolvedValue({ ...emptyContext(now), ...overrides });
}
function stocks(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const asset = assetFixture({ id: `a${index}`, ticker: `TCK${index}4` });

    return listRowFixture({
      ...asset,
      operations: [
        operationFixture({
          assetId: asset.id,
          date: '2026-03-10',
          quantity: Decimal8.parse('100'),
          total: 100_000,
          unitPrice: Decimal8.parse('10'),
        }),
      ],
    });
  });
}
function usdRow() {
  const asset = assetFixture({
    assetClass: InvestmentAssetClass.FOREIGN_STOCK,
    currency: 'USD',
    id: 'aapl',
    ticker: 'AAPL',
  });

  return listRowFixture({
    ...asset,
    operations: [
      operationFixture({
        assetId: asset.id,
        date: '2025-11-10',
        fxRate: '5.2236',
        quantity: Decimal8.parse('20'),
        total: 364_200,
        unitPrice: Decimal8.parse('182.10'),
      }),
    ],
  });
}

describe('GetInvestmentsDashboardUseCase', () => {
  it('SHOULD throw 403 WHEN any requested owner is not accessible, reading nothing', async () => {
    await expect(setup.execute({ ...input, ownerIds: ['user-1', 'stranger'] })).rejects.toThrow(
      ForbiddenException,
    );
    expect(spies.findAssetsByOwners).not.toHaveBeenCalled();
  });

  it('SHOULD refuse a period in the future, reversed or above 10 years', async () => {
    await expect(setup.execute({ ...input, to: '2026-11-05' })).rejects.toThrow(ValidationError);
    await expect(setup.execute({ ...input, from: '2026-11-05', to: '2026-11-04' })).rejects.toThrow(
      ValidationError,
    );
    await expect(setup.execute({ ...input, from: '2015-11-03' })).rejects.toThrow(ValidationError);
  });

  it('SHOULD answer empty blocks WITHOUT reading quotes, history or incomes WHEN there are no assets', async () => {
    spies.findAssetsByOwners.mockResolvedValue([]);

    const result = await setup.execute(input);

    expect(result.ranking).toEqual([]);
    expect(result.summary.currentValue).toBe(0);
    expect(loadSpy).not.toHaveBeenCalled();
    expect(quoteRepoSpies.findHistoryBatch).not.toHaveBeenCalled();
    expect(incomeSpies.findDashboardIncomes).not.toHaveBeenCalled();
  });

  it('SHOULD read the active assets of the requested owners only; an explicit archived family is readable', async () => {
    spies.findAssetsByOwners.mockResolvedValue([]);

    await setup.execute({ ...input, ownerIds: ['user-1', 'fam'] });
    expect(spies.findAssetsByOwners).toHaveBeenLastCalledWith(
      [mocks.owners[0], mocks.owners[2]],
      'ACTIVE',
    );

    await setup.execute({ ...input, ownerIds: ['fam-archived'] });
    expect(spies.findAssetsByOwners).toHaveBeenLastCalledWith([mocks.owners[1]], 'ACTIVE');
  });

  it('SHOULD load each data set ONCE however many assets there are', async () => {
    for (const count of [3, 30]) {
      jest.clearAllMocks();
      spies.findAssetsByOwners.mockResolvedValue(stocks(count));
      loaded();

      await setup.execute(input);

      expect(spies.findAssetsByOwners).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(spies.findValuationsByAssets).toHaveBeenCalledTimes(1);
      expect(quoteRepoSpies.findHistoryBatch).toHaveBeenCalledTimes(1);
      expect(incomeSpies.findDashboardIncomes).toHaveBeenCalledTimes(1);
      expect(quoteRepoSpies.findFxOnOrBefore).not.toHaveBeenCalled();
    }
  });

  it('SHOULD ask the history of the listed symbols for the period AND the incomes up to the end of the month of today', async () => {
    spies.findAssetsByOwners.mockResolvedValue(stocks(2));
    loaded();

    await setup.execute(input);

    expect(spies.findValuationsByAssets).toHaveBeenCalledWith(['a0', 'a1']);
    expect(quoteRepoSpies.findHistoryBatch).toHaveBeenCalledWith(
      [
        { market: QuoteMarket.B3, ticker: 'TCK04' },
        { market: QuoteMarket.B3, ticker: 'TCK14' },
      ],
      '2025-12-01',
      '2026-11-04',
    );
    expect(incomeSpies.findDashboardIncomes).toHaveBeenCalledWith(
      [mocks.owners[0]],
      '2025-12-01',
      '2026-11-30',
    );
  });

  it('SHOULD read the dollar from the oldest USD operation, plus the current quote, WHEN there is a USD asset', async () => {
    spies.findAssetsByOwners.mockResolvedValue([usdRow()]);
    quoteRepoSpies.findFxOnOrBefore.mockResolvedValue('5.100000');
    quoteRepoSpies.findFxHistory.mockResolvedValue([
      { date: '2026-06-30', pair: 'USD-BRL', rate: '5.000000', source: 'BRAPI' },
    ]);
    quoteRepoSpies.findHistoryBatch.mockResolvedValue([
      {
        close: Decimal8.parse('231.40'),
        date: '2026-11-04',
        market: QuoteMarket.US,
        source: 'FINNHUB',
        ticker: 'AAPL',
      },
    ]);
    loaded({
      fx: {
        pair: 'USD-BRL',
        quotedAt: new Date('2026-11-04T16:00:00Z'),
        rate: '5.5601',
        source: 'BRAPI',
      },
    });

    const result = await setup.execute(input);

    expect(quoteRepoSpies.findFxOnOrBefore).toHaveBeenCalledWith('USD-BRL', '2025-11-10');
    expect(quoteRepoSpies.findFxHistory).toHaveBeenCalledWith(
      'USD-BRL',
      '2025-11-10',
      '2026-11-04',
    );
    // The period end uses the current quote; June has no close yet, so the operation price at the rate of the day.
    expect(result.ranking[0]?.value).toBe(2_573_214);
    expect(result.series.find((point) => point.date === '2026-06-30')?.marketValue).toBe(1_821_000);
  });
});
