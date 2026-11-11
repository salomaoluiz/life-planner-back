import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { incomeFixture } from '@investment/domain/entity/mocks/income.fixture';
import { InvestmentIncomeType } from '@investment/domain/enum';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, id: scenario.income.id, userId: 'user-1' };

it('SHOULD keep every stored field WHEN the body is empty AND rewrite the same income', async () => {
  await setup.execute(base);

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-1',
      amountPerUnit: '0.28',
      categoryId: 'cat-1',
      exDate: '2026-09-10',
      incomeId: scenario.income.id,
      netAmount: 7140,
      paid: true,
      paymentDate: '2026-10-30',
      quantity: '300',
      type: InvestmentIncomeType.JCP,
    }),
  );
});

it('SHOULD apply every field of the body, including clearing the optional ones', async () => {
  await setup.execute({
    ...base,
    accountId: 'acc-2',
    amountPerUnit: null,
    categoryId: 'cat-1',
    exDate: null,
    netAmount: 9000,
    notes: null,
    paymentDate: '2026-11-01',
    quantity: '10',
    status: 'PLANNED',
    type: InvestmentIncomeType.DIVIDEND,
  });

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-2',
      amountPerUnit: null,
      exDate: null,
      netAmount: 9000,
      notes: null,
      paid: false,
      paymentDate: '2026-11-01',
      quantity: '10',
      type: InvestmentIncomeType.DIVIDEND,
    }),
  );
});

it('SHOULD validate the new account (currency)', async () => {
  spies.investment.findAccountForOperation.mockResolvedValue({
    ...scenario.account,
    currency: 'USD',
  });

  await expect(setup.execute({ ...base, accountId: 'acc-2' })).rejects.toMatchObject({
    response: { code: 'CURRENCY_MISMATCH' },
  });
});

it('SHOULD answer 404 for an unknown income OR an asset out of reach', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.investment.findAssetById.mockResolvedValueOnce({ ...scenario.detail, ownerId: 'other' });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 403 WHEN the current account of the income is out of the caller reach', async () => {
  spies.investment.findAccountForOperation.mockResolvedValueOnce({
    ...scenario.account,
    ownerId: 'left-user',
  });

  await expect(setup.execute(base)).rejects.toBeInstanceOf(ForbiddenException);
  expect(spies.incomes.writeIncome).not.toHaveBeenCalled();
});

it('SHOULD answer 422 INCOME_INCOMPLETE WHEN the finance row lost its account or category', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce(
    incomeFixture({ accountId: null, assetId: scenario.asset.id, categoryId: null }),
  );

  await expect(setup.execute(base)).rejects.toMatchObject({
    response: { code: 'INCOME_INCOMPLETE', missing: ['accountId', 'categoryId'] },
  });
});

it('SHOULD let the owner pick the account and category of an income whose row lost them', async () => {
  spies.incomes.findIncomeById
    .mockResolvedValueOnce(
      incomeFixture({ accountId: null, assetId: scenario.asset.id, categoryId: null }),
    )
    .mockResolvedValue(scenario.income);

  await setup.execute({ ...base, accountId: 'acc-1', categoryId: 'cat-1' });

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: 'acc-1', categoryId: 'cat-1' }),
  );
});
