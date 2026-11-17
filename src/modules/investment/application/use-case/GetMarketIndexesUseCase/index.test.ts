import { InvestmentFixedIncomeRateMode, MarketIndexSeries } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { setup, spies } from './index.mocks';

const input = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  today: '2026-11-16',
};

beforeEach(() => {
  jest.resetAllMocks();
  spies.findLatest.mockResolvedValue(new Map());
  spies.findFetches.mockResolvedValue([]);
  spies.findFxPairs.mockResolvedValue([]);
  spies.findFollowers.mockResolvedValue([]);
  spies.findHistory.mockResolvedValue([]);
});

describe('GetMarketIndexesUseCase', () => {
  it('SHOULD answer null indexes AND a null last success BEFORE the first run', async () => {
    expect(await (await setup()).execute(input)).toEqual({
      cdi: null,
      fx: [],
      ipca: null,
      lastSuccessAt: null,
      selic: null,
    });
  });

  it('SHOULD answer the latest values, the last change AND the followers of the caller', async () => {
    spies.findLatest.mockResolvedValue(
      new Map([
        [MarketIndexSeries.CDI_ANNUAL, { date: '2026-11-13', value: '14.9' }],
        [MarketIndexSeries.CDI_DAILY, { date: '2026-11-13', value: '0.055131' }],
      ]),
    );
    spies.findHistory.mockImplementation(async (series: MarketIndexSeries) =>
      series === MarketIndexSeries.CDI_ANNUAL
        ? [
            { date: '2026-03-19', value: '14.15' },
            { date: '2026-06-18', value: '14.9' },
            { date: '2026-11-13', value: '14.9' },
          ]
        : [],
    );
    spies.findFollowers.mockResolvedValue([
      {
        assetId: 'a',
        cdiPercent: '110',
        mode: InvestmentFixedIncomeRateMode.CDI_PERCENT,
        name: 'CDB',
        spread: null,
      },
    ]);

    const summary = await (await setup()).execute(input);

    expect(summary.cdi).toMatchObject({
      annual: '14.90',
      followers: 1,
      lastChangeDate: '2026-06-18',
      stale: false,
    });
    expect(spies.findFollowers).toHaveBeenCalledWith(input.accessibleOwners, '2026-11-16');
    expect(spies.findHistory).toHaveBeenCalledTimes(2);
  });
});
