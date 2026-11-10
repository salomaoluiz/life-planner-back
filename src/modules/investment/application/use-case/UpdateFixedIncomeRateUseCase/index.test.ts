import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
  fixedIncomeRateFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { setup, spies } from './index.mocks';

const first = fixedIncomeRateFixture({ id: 'rate-1' });
const second = fixedIncomeRateFixture({ id: 'rate-2', startDate: '2026-10-01' });
const input = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  id: 'rate-2',
  rate: { annualRate: '10', mode: 'PREFIXED' as never, startDate: '2026-10-01' },
};

beforeEach(() => {
  spies.findFixedIncomeRateById.mockResolvedValue(second);
  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture({ rates: [first, second] })]]),
  );
});

it('SHOULD rewrite the entry', async () => {
  await setup.execute(input);

  expect(spies.updateFixedIncomeRate).toHaveBeenCalledWith(
    'asset-fi',
    'rate-2',
    expect.objectContaining({ annualRate: '10', effectiveRate: '10.000000' }),
  );
});

it('SHOULD answer 404 for an unknown entry', async () => {
  spies.findFixedIncomeRateById.mockResolvedValue(undefined);

  await expect(setup.execute(input)).rejects.toThrow(NotFoundException);
});

it('SHOULD answer 409 WHEN moving onto the date of another entry', async () => {
  await expect(
    setup.execute({ ...input, rate: { ...input.rate, startDate: '2026-01-02' } }),
  ).rejects.toThrow(ConflictException);
});

it('SHOULD refuse moving the first entry after the first contribution', async () => {
  spies.findFixedIncomeRateById.mockResolvedValue(first);
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture({ rates: [first] })]]),
  );

  await expect(
    setup.execute({ ...input, id: 'rate-1', rate: { ...input.rate, startDate: '2026-03-01' } }),
  ).rejects.toThrow(UnprocessableEntityException);
});
