import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { InvestmentAssetStatus } from '@investment/domain/enum';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, id: scenario.income.id };

it('SHOULD delete the income', async () => {
  await setup.execute(base);

  expect(spies.incomes.deleteIncome).toHaveBeenCalledWith(scenario.income.id);
});

it('SHOULD answer 404 for an unknown income', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce(undefined);

  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 422 for an archived asset AND 403 WHEN the account is out of reach', async () => {
  spies.investment.findAssetById.mockResolvedValueOnce(scenario.detail).mockResolvedValueOnce({
    ...scenario.detail,
    status: InvestmentAssetStatus.ARCHIVED,
  });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(UnprocessableEntityException);

  spies.investment.findAccountForOperation.mockResolvedValueOnce({
    ...scenario.account,
    ownerId: 'left-user',
  });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(ForbiddenException);
  expect(spies.incomes.deleteIncome).not.toHaveBeenCalled();
});

it('SHOULD delete an income whose finance row is gone (no account)', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce({ ...scenario.income, accountId: null });

  await setup.execute(base);

  expect(spies.incomes.deleteIncome).toHaveBeenCalled();
});
