import { ConflictException, NotFoundException } from '@nestjs/common';

import {
  incomeEventFixture,
  incomeSuggestionFixture,
} from '@investment/domain/entity/mocks/income.fixture';
import { InvestmentIncomeType, InvestmentSuggestionStatus } from '@investment/domain/enum';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, id: 'sug-1', userId: 'user-1' };

function pending(event = incomeEventFixture()) {
  return incomeSuggestionFixture({ assetId: scenario.asset.id, event, id: 'sug-1' });
}

beforeEach(() => {
  spies.incomes.findSuggestionById.mockResolvedValue(pending());
});

it('SHOULD create the planned income of the suggestion with the defaults AND link the suggestion', async () => {
  await setup.execute(base);

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-1',
      amountPerUnit: '0.47',
      categoryId: 'cat-1',
      exDate: '2026-11-21',
      netAmount: 14100,
      paid: false,
      paymentDate: '2026-12-19',
      quantity: '300',
      suggestionId: 'sug-1',
      type: InvestmentIncomeType.DIVIDEND,
    }),
  );
});

it('SHOULD take off the withholding of a JCP in the net estimate', async () => {
  spies.incomes.findSuggestionById.mockResolvedValue(
    pending(incomeEventFixture({ amountPerUnit: '0.28', type: InvestmentIncomeType.JCP })),
  );

  await setup.execute(base);

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({ netAmount: 7140 }),
  );
});

it('SHOULD store what the owner typed WHEN approving with edits', async () => {
  await setup.execute({
    ...base,
    accountId: 'acc-1',
    amountPerUnit: '0.4667',
    categoryId: 'cat-1',
    exDate: null,
    netAmount: 14000,
    notes: 'edited',
    paymentDate: '2026-12-20',
    quantity: '300',
    status: 'RECEIVED',
    type: InvestmentIncomeType.OTHER,
  });

  expect(spies.incomes.writeIncome).toHaveBeenCalledWith(
    expect.objectContaining({
      amountPerUnit: '0.4667',
      exDate: null,
      netAmount: 14000,
      notes: 'edited',
      paid: true,
      paymentDate: '2026-12-20',
      type: InvestmentIncomeType.OTHER,
    }),
  );
});

it('SHOULD estimate zero WHEN the owner clears quantity or per-unit value (and ask for the amount)', async () => {
  await expect(setup.execute({ ...base, quantity: null })).rejects.toMatchObject({
    response: { code: 'INCOME_INCOMPLETE', missing: ['netAmount'] },
  });
});

it('SHOULD answer 422 INCOME_INCOMPLETE with the missing fields', async () => {
  spies.incomes.findSuggestionById.mockResolvedValue(
    pending(incomeEventFixture({ paymentDate: null })),
  );
  spies.incomes.findDefaultAccountId.mockResolvedValue(undefined);
  spies.incomes.findLastIncomeCategoryId.mockResolvedValue(undefined);

  await expect(setup.execute(base)).rejects.toMatchObject({
    response: {
      code: 'INCOME_INCOMPLETE',
      missing: ['paymentDate', 'accountId', 'categoryId'],
    },
  });
  expect(spies.incomes.writeIncome).not.toHaveBeenCalled();
});

it('SHOULD answer 404 for an unknown suggestion OR an asset out of reach', async () => {
  spies.incomes.findSuggestionById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.investment.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it.each([
  InvestmentSuggestionStatus.APPROVED,
  InvestmentSuggestionStatus.REJECTED,
  InvestmentSuggestionStatus.DISMISSED,
])('SHOULD answer 409 for a %s suggestion', async (status) => {
  spies.incomes.findSuggestionById.mockResolvedValue({ ...pending(), status });

  await expect(setup.execute(base)).rejects.toBeInstanceOf(ConflictException);
});
