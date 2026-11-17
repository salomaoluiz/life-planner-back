import {
  InvestmentFixedIncomeRateMode,
  MarketIndex,
  MarketIndexSeries,
} from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { setup, spies } from './index.mocks';

const input = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  from: '2025-11-12',
  index: MarketIndex.CDI,
  to: '2026-11-12',
  today: '2026-11-16',
};

beforeEach(() => {
  jest.resetAllMocks();
  spies.findFollowers.mockResolvedValue([
    {
      assetId: 'a',
      cdiPercent: '110',
      mode: InvestmentFixedIncomeRateMode.CDI_PERCENT,
      name: 'CDB',
      spread: null,
    },
    {
      assetId: 'b',
      cdiPercent: null,
      mode: InvestmentFixedIncomeRateMode.IPCA_PLUS,
      name: 'NTN',
      spread: '6',
    },
  ]);
});

describe('GetMarketIndexHistoryUseCase', () => {
  it('SHOULD return only the change points of the CDI with the changes table AND its followers', async () => {
    spies.findHistory.mockResolvedValue([
      { date: '2025-12-11', value: '13.65' },
      { date: '2025-12-12', value: '13.65' },
      { date: '2026-03-19', value: '14.15' },
    ]);

    const view = await (await setup()).execute(input);

    expect(spies.findHistory).toHaveBeenCalledWith(
      MarketIndexSeries.CDI_ANNUAL,
      '2025-11-12',
      '2026-11-12',
    );
    expect(view.points).toEqual([
      { date: '2025-12-11', value: '13.65' },
      { date: '2026-03-19', value: '14.15' },
    ]);
    expect(view.changes).toEqual([
      { delta: '0.50', since: '2026-03-19', value: '14.15' },
      { delta: null, since: '2025-12-11', value: '13.65' },
    ]);
    expect(view.followers).toEqual([{ assetId: 'a', name: 'CDB', percent: '110' }]);
  });

  it('SHOULD read the Selic target for the Selic', async () => {
    spies.findHistory.mockResolvedValue([]);

    await (await setup()).execute({ ...input, index: MarketIndex.SELIC });

    expect(spies.findHistory).toHaveBeenCalledWith(
      MarketIndexSeries.SELIC_TARGET,
      '2025-11-12',
      '2026-11-12',
    );
  });

  it('SHOULD return monthly points AND no changes for the IPCA, with the spread of its followers', async () => {
    spies.findHistory.mockImplementation(async (series: MarketIndexSeries) =>
      series === MarketIndexSeries.IPCA_MONTHLY
        ? [{ date: '2026-10-01', value: '0.14' }]
        : [{ date: '2026-10-01', value: '4.63' }],
    );

    const view = await (await setup()).execute({ ...input, index: MarketIndex.IPCA });

    expect(view.points).toEqual([{ accumulated12m: '4.63', month: '2026-10', monthly: '0.14' }]);
    expect(view.changes).toEqual([]);
    expect(view.followers).toEqual([{ assetId: 'b', name: 'NTN', spread: '6' }]);
  });

  it('SHOULD refuse a period over 30 years AND an inverted one', async () => {
    const useCase = await setup();

    await expect(useCase.execute({ ...input, from: '1990-01-01' })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      useCase.execute({ ...input, from: '2026-11-12', to: '2025-11-12' }),
    ).rejects.toThrow(ValidationError);
    expect(spies.findHistory).not.toHaveBeenCalled();
  });

  it('SHOULD accept exactly 30 years', async () => {
    spies.findHistory.mockResolvedValue([]);

    await expect(
      (await setup()).execute({ ...input, from: '1996-11-12', to: '2026-11-12' }),
    ).resolves.toBeDefined();
  });
});
