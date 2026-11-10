import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
  fixedIncomeRateFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { setup, spies } from './index.mocks';

const first = fixedIncomeRateFixture({ id: 'rate-1' });
const second = fixedIncomeRateFixture({ id: 'rate-2', startDate: '2026-10-01' });
const input = { accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }], id: 'rate-2' };

beforeEach(() => {
  spies.findFixedIncomeRateById.mockResolvedValue(second);
  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture({ rates: [first, second] })]]),
  );
});

it('SHOULD delete a later entry', async () => {
  await setup.execute(input);

  expect(spies.deleteFixedIncomeRate).toHaveBeenCalledWith('asset-fi', 'rate-2');
});

it('SHOULD refuse deleting the only entry', async () => {
  spies.findFixedIncomeRateById.mockResolvedValue(first);
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture({ rates: [first] })]]),
  );

  await expect(setup.execute({ ...input, id: 'rate-1' })).rejects.toThrow(
    UnprocessableEntityException,
  );
  expect(spies.deleteFixedIncomeRate).not.toHaveBeenCalled();
});

it('SHOULD refuse deleting the first entry WHEN the next one starts after the first contribution', async () => {
  spies.findFixedIncomeRateById.mockResolvedValue(first);

  await expect(setup.execute({ ...input, id: 'rate-1' })).rejects.toThrow(
    UnprocessableEntityException,
  );
});

it('SHOULD answer 404 for an unknown entry', async () => {
  spies.findFixedIncomeRateById.mockResolvedValue(undefined);

  await expect(setup.execute(input)).rejects.toThrow(NotFoundException);
});
