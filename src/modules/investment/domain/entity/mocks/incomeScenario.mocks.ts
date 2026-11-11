import { Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import {
  incomeCategoryFixture,
  incomeFixture,
  incomeRepositorySpies,
} from '@investment/domain/entity/mocks/income.fixture';
import { assetFixture, repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 107: the world every income use case test starts from: a user-owned asset, its default account (BRL,
// active, writable) and an active income category of the same owner.
export async function buildIncomeUseCase<T>(
  useCase: Type<T>,
  spies: ReturnType<typeof wireIncomeSpies>,
): Promise<T> {
  const module = await Test.createTestingModule({
    providers: [
      useCase,
      { provide: 'IInvestmentRepository', useValue: spies.investment },
      { provide: 'IIncomeRepository', useValue: spies.incomes },
    ],
  }).compile();

  return module.get(useCase);
}
export function incomeScenario() {
  const owners = [{ owner: OwnerType.USER, ownerId: 'user-1' }];
  const asset = assetFixture({ ownerId: 'user-1' });
  const detail = { ...asset, operations: [], valuations: [] };
  const account = {
    archived: false,
    currency: 'BRL',
    id: 'acc-1',
    owner: OwnerType.USER,
    ownerId: 'user-1',
  };
  const category = incomeCategoryFixture();
  const income = incomeFixture({ assetId: asset.id });

  return { account, asset, category, detail, income, owners };
}
export function wireIncomeSpies(scenario: ReturnType<typeof incomeScenario>) {
  const investment = repositorySpies();
  const incomes = incomeRepositorySpies();

  investment.findAssetById.mockResolvedValue(scenario.detail);
  investment.findAccountForOperation.mockResolvedValue(scenario.account);
  incomes.findCategoryById.mockResolvedValue(scenario.category);
  incomes.findIncomeById.mockResolvedValue(scenario.income);
  incomes.writeIncome.mockResolvedValue(scenario.income.id);
  incomes.findDefaultAccountId.mockResolvedValue(scenario.account.id);
  incomes.findLastIncomeCategoryId.mockResolvedValue(scenario.category.id);

  return { incomes, investment };
}
