import { NotFoundException } from '@nestjs/common';

import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { setup, spies } from './index.mocks';

const input = { accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }], id: 'adj-1' };

beforeEach(() => {
  spies.findFixedIncomeAdjustmentById.mockResolvedValue({
    assetId: 'asset-fi',
    date: '2026-07-01',
    grossAmount: 1_100_000,
    id: 'adj-1',
  });
  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture()]]),
  );
});

it('SHOULD delete the adjustment of a calculated title', async () => {
  await setup.execute(input);

  expect(spies.deleteFixedIncomeAdjustment).toHaveBeenCalledWith('asset-fi', 'adj-1');
});

it('SHOULD answer 404 for an unknown adjustment', async () => {
  spies.findFixedIncomeAdjustmentById.mockResolvedValue(undefined);

  await expect(setup.execute(input)).rejects.toThrow(NotFoundException);
});
