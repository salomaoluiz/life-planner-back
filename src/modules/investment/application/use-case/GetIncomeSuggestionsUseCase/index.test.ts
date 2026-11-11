import { NotFoundException } from '@nestjs/common';

import {
  incomeEventFixture,
  incomeSuggestionFixture,
} from '@investment/domain/entity/mocks/income.fixture';
import { listRowFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentIncomeType } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners };

function suggestion(overrides = {}, event = incomeEventFixture()) {
  return incomeSuggestionFixture({ assetId: scenario.asset.id, event, ...overrides });
}

beforeEach(() => {
  spies.investment.findAssetsByOwners.mockResolvedValue([listRowFixture({ ...scenario.asset })]);
  spies.incomes.findPendingSuggestions.mockResolvedValue([suggestion()]);
});

it('SHOULD answer the estimate WHEN approving can create the income right away', async () => {
  expect(await setup.execute(base)).toEqual([
    {
      amountPerUnit: '0.47',
      assetId: scenario.asset.id,
      canApproveDirectly: true,
      currency: 'BRL',
      estimatedGross: 14100,
      estimatedNet: 14100,
      exDate: '2026-11-21',
      id: expect.any(String),
      paymentDate: '2026-12-19',
      quantity: '300',
      ticker: 'ITSA4',
      type: InvestmentIncomeType.DIVIDEND,
      withholdingRate: '0',
    },
  ]);
});

it('SHOULD estimate the net with the rate for a JCP', async () => {
  spies.incomes.findPendingSuggestions.mockResolvedValue([
    suggestion({}, incomeEventFixture({ amountPerUnit: '0.28', type: InvestmentIncomeType.JCP })),
  ]);

  expect((await setup.execute(base))[0]).toMatchObject({
    estimatedGross: 8400,
    estimatedNet: 7140,
    withholdingRate: '0.15',
  });
});

it('SHOULD NOT approve directly WHEN there is no payment date, account OR category', async () => {
  spies.incomes.findPendingSuggestions.mockResolvedValue([
    suggestion({}, incomeEventFixture({ paymentDate: null })),
  ]);
  expect((await setup.execute(base))[0].canApproveDirectly).toBe(false);

  spies.incomes.findPendingSuggestions.mockResolvedValue([suggestion()]);
  spies.incomes.findDefaultAccountId.mockResolvedValue(undefined);
  expect((await setup.execute(base))[0].canApproveDirectly).toBe(false);

  spies.incomes.findDefaultAccountId.mockResolvedValue('acc-1');
  spies.incomes.findLastIncomeCategoryId.mockResolvedValue(undefined);
  expect((await setup.execute(base))[0].canApproveDirectly).toBe(false);
});

it('SHOULD resolve the defaults once per asset and type', async () => {
  spies.incomes.findPendingSuggestions.mockResolvedValue([
    suggestion(),
    suggestion({}, incomeEventFixture({ exDate: '2026-10-21' })),
  ]);

  expect(await setup.execute(base)).toHaveLength(2);
  expect(spies.incomes.findDefaultAccountId).toHaveBeenCalledTimes(1);
});

it('SHOULD skip a suggestion of an asset that is not in the list', async () => {
  spies.incomes.findPendingSuggestions.mockResolvedValue([suggestion({ assetId: 'other' })]);

  expect(await setup.execute(base)).toEqual([]);
});

it('SHOULD read one asset (404 WHEN out of reach) OR narrow the owners', async () => {
  await setup.execute({ ...base, assetId: scenario.asset.id });
  expect(spies.investment.findAssetsByOwners).not.toHaveBeenCalled();

  spies.investment.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...base, assetId: scenario.asset.id })).rejects.toBeInstanceOf(
    NotFoundException,
  );

  const owners = [
    { owner: OwnerType.USER, ownerId: 'user-1' },
    { owner: OwnerType.FAMILY, ownerId: 'family-1' },
  ];

  await setup.execute({ accessibleOwners: owners, owner: 'FAMILY' });
  expect(spies.investment.findAssetsByOwners).toHaveBeenCalledWith([owners[1]], 'ACTIVE');
});
