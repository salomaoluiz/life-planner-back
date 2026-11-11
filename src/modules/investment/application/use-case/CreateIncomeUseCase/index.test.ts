import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { incomeCategoryFixture } from '@investment/domain/entity/mocks/income.fixture';
import { InvestmentAssetStatus, InvestmentIncomeType } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { scenario, setup, spies } from './index.mocks';

const base = {
  accessibleOwners: scenario.owners,
  accountId: 'acc-1',
  amountPerUnit: '0.28',
  assetId: scenario.asset.id,
  categoryId: 'cat-1',
  exDate: '2026-09-10',
  netAmount: 7140,
  paymentDate: '2026-10-30',
  quantity: '300',
  status: 'RECEIVED' as const,
  type: InvestmentIncomeType.JCP,
  userId: 'user-1',
};

it('SHOULD write a received income AND answer its view with the withholding estimate', async () => {
  const view = await setup.execute(base);

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith({
    accountId: 'acc-1',
    amountPerUnit: '0.28',
    assetId: scenario.asset.id,
    assetLabel: 'ITSA4',
    categoryId: 'cat-1',
    createdBy: 'user-1',
    currency: 'BRL',
    exDate: '2026-09-10',
    incomeId: undefined,
    netAmount: 7140,
    notes: null,
    paid: true,
    paymentDate: '2026-10-30',
    quantity: '300',
    suggestionId: undefined,
    type: InvestmentIncomeType.JCP,
  });
  expect(view).toMatchObject({
    estimatedGross: 8400,
    estimatedWithheld: 1260,
    overdue: false,
    status: 'RECEIVED',
    withholdingRate: '0.15',
  });
});

it('SHOULD write a planned income WHEN the status is PLANNED AND trim the notes', async () => {
  await setup.execute({ ...base, notes: '  note  ', status: 'PLANNED' });

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({ notes: 'note', paid: false }),
  );
});

it('SHOULD accept an income without quantity, per-unit value AND ex-date', async () => {
  await setup.execute({ ...base, amountPerUnit: null, exDate: null, quantity: null });

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({ amountPerUnit: null, exDate: null, quantity: null }),
  );
});

it('SHOULD answer 422 CURRENCY_MISMATCH WHEN the account currency differs from the asset', async () => {
  spies.investment.findAccountForOperation.mockResolvedValue({
    ...scenario.account,
    currency: 'USD',
  });

  await expect(setup.execute(base)).rejects.toMatchObject({
    response: { code: 'CURRENCY_MISMATCH' },
  });
  expect(spies.incomes.writeIncome).not.toHaveBeenCalled();
});

it('SHOULD answer 422 ACCOUNT_ARCHIVED for an archived account', async () => {
  spies.investment.findAccountForOperation.mockResolvedValue({
    ...scenario.account,
    archived: true,
  });

  await expect(setup.execute(base)).rejects.toMatchObject({
    response: { code: 'ACCOUNT_ARCHIVED' },
  });
});

it('SHOULD answer 404 for an unknown account, an account out of reach OR an unknown asset', async () => {
  spies.investment.findAccountForOperation.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.investment.findAccountForOperation.mockResolvedValueOnce({
    ...scenario.account,
    ownerId: 'someone-else',
  });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.investment.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 404 WHEN the category does not exist OR the account owner cannot use it', async () => {
  spies.incomes.findCategoryById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.incomes.findCategoryById.mockResolvedValueOnce(
    incomeCategoryFixture({ owner: OwnerType.FAMILY, ownerId: 'family-1' }),
  );
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD accept an all-scopes category that lists the account owner', async () => {
  spies.incomes.findCategoryById.mockResolvedValueOnce(
    incomeCategoryFixture({
      allScopes: true,
      owner: OwnerType.USER,
      ownerId: 'creator',
      scopes: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
    }),
  );

  await expect(setup.execute(base)).resolves.toBeDefined();
});

it('SHOULD answer 422 CATEGORY_NOT_INCOME for an expense OR a system category AND CATEGORY_ARCHIVED', async () => {
  spies.incomes.findCategoryById.mockResolvedValueOnce(incomeCategoryFixture({ isIncome: false }));
  await expect(setup.execute(base)).rejects.toMatchObject({
    response: { code: 'CATEGORY_NOT_INCOME' },
  });

  spies.incomes.findCategoryById.mockResolvedValueOnce(
    incomeCategoryFixture({ isSystem: true, owner: null, ownerId: null }),
  );
  await expect(setup.execute(base)).rejects.toMatchObject({
    response: { code: 'CATEGORY_NOT_INCOME' },
  });

  spies.incomes.findCategoryById.mockResolvedValueOnce(incomeCategoryFixture({ archived: true }));
  await expect(setup.execute(base)).rejects.toMatchObject({
    response: { code: 'CATEGORY_ARCHIVED' },
  });
});

it('SHOULD answer 422 NOTES_TOO_LONG above 1000 characters', async () => {
  await expect(setup.execute({ ...base, notes: 'x'.repeat(1001) })).rejects.toMatchObject({
    response: { code: 'NOTES_TOO_LONG' },
  });
});

it('SHOULD answer 422 for an archived family on the asset OR the account side, AND for an archived asset', async () => {
  const archived = [{ archived: true, owner: OwnerType.USER, ownerId: 'user-1' }];

  await expect(setup.execute({ ...base, accessibleOwners: archived })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );

  spies.investment.findAssetById.mockResolvedValueOnce({
    ...scenario.detail,
    status: InvestmentAssetStatus.ARCHIVED,
  });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(UnprocessableEntityException);
});

it('SHOULD answer 404 WHEN the saved income cannot be read back', async () => {
  spies.incomes.findIncomeById.mockResolvedValueOnce(undefined);

  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});
