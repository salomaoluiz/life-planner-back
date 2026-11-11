import { NotFoundException } from '@nestjs/common';

import { incomeFixture } from '@investment/domain/entity/mocks/income.fixture';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, id: scenario.income.id };

it('SHOULD answer the income view', async () => {
  expect(await setup.execute(base)).toMatchObject({
    income: { id: scenario.income.id },
    overdue: false,
    status: 'RECEIVED',
  });
});

it('SHOULD show a planned income with a past payment date as overdue', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce(
    incomeFixture({ paid: false, paymentDate: '2020-01-01' }),
  );
  spies.investment.findAssetById.mockResolvedValue(scenario.detail);

  expect(await setup.execute(base)).toMatchObject({ overdue: true, status: 'PLANNED' });
});

it('SHOULD answer 404 WHEN the income OR its asset is out of reach', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.investment.findAssetById.mockResolvedValueOnce({ ...scenario.detail, ownerId: 'other' });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});
