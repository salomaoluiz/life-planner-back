import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { FixedIncomeRedemptionTooLargeError } from '@investment/domain/error/FixedIncomeRedemptionTooLargeError';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { setup, spies } from './index.mocks';

const input = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  assetId: 'asset-fi',
  rate: {
    cdiPercent: '110',
    indexRate: '15.2',
    mode: 'CDI_PERCENT' as never,
    startDate: '2026-10-01',
  },
};

beforeEach(() => {
  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture()]]),
  );
});

it('SHOULD add the entry with its derived effective rate', async () => {
  await setup.execute(input);

  expect(spies.createFixedIncomeRate).toHaveBeenCalledWith(
    'asset-fi',
    expect.objectContaining({ mode: 'CDI_PERCENT', startDate: '2026-10-01' }),
  );
});

it('SHOULD answer 409 for a start date that already has a rate', async () => {
  await expect(
    setup.execute({ ...input, rate: { ...input.rate, startDate: '2026-01-02' } }),
  ).rejects.toThrow(ConflictException);
  expect(spies.createFixedIncomeRate).not.toHaveBeenCalled();
});

it('SHOULD answer 422 with the redemption WHEN the change makes it larger than the title', async () => {
  spies.createFixedIncomeRate.mockRejectedValue(
    new FixedIncomeRedemptionTooLargeError('2026-11-04', 'sell-1'),
  );

  await expect(setup.execute(input)).rejects.toMatchObject({
    response: { details: { date: '2026-11-04', operationId: 'sell-1' } },
  });
});

it('SHOULD refuse an asset that is not a calculated title', async () => {
  spies.findFixedIncomeByAssetIds.mockResolvedValue(new Map());

  await expect(setup.execute(input)).rejects.toThrow(UnprocessableEntityException);
});
