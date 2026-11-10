import { UnprocessableEntityException } from '@nestjs/common';

import { emptyContext } from '@investment/application/service/QuoteContext';
import { quoteSpies } from '@investment/application/service/QuoteContext/index.mocks';
import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { setup, spies } from './index.mocks';

const input = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  assetId: 'asset-fi',
  date: '2026-07-01',
  grossAmount: 1_100_000,
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T15:00:00Z'));
  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture()]]),
  );
  quoteSpies.load.mockResolvedValue({
    ...emptyContext(),
    fixedIncome: new Map([
      [
        'asset-fi',
        fixedIncomeDataFixture({
          adjustments: [
            { assetId: 'asset-fi', date: '2026-07-01', grossAmount: 1_100_000, id: 'adj-1' },
          ],
        }),
      ],
    ]),
  });
});

afterEach(() => jest.useRealTimers());

it('SHOULD save the adjustment AND return the gross the curve gave before it', async () => {
  const result = await setup.execute(input);

  expect(spies.upsertFixedIncomeAdjustment).toHaveBeenCalledWith(
    'asset-fi',
    '2026-07-01',
    1_100_000,
  );
  expect(result.computedGross).toBeGreaterThan(1_000_000);
  expect(result.computedGross).toBeLessThan(1_100_000);
  expect(result.item).toEqual({ date: '2026-07-01', grossAmount: 1_100_000, id: 'adj-1' });
});

it('SHOULD refuse a date before the first contribution OR after the maturity', async () => {
  await expect(setup.execute({ ...input, date: '2025-12-31' })).rejects.toThrow(
    UnprocessableEntityException,
  );
  expect(spies.upsertFixedIncomeAdjustment).not.toHaveBeenCalled();
});
