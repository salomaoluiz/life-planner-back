import { Test } from '@nestjs/testing';

import { incomeRepositorySpies } from '@investment/domain/entity/mocks/income.fixture';
import {
  quoteRepositorySpies,
  repositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetInvestmentsDashboardUseCase } from './index';

export const spies = repositorySpies();
export const quoteSpies = quoteRepositorySpies();
export const incomeSpies = incomeRepositorySpies();

export const mocks = {
  owners: [
    { owner: OwnerType.USER, ownerId: 'user-1' },
    { archived: true, owner: OwnerType.FAMILY, ownerId: 'fam-archived' },
    { owner: OwnerType.FAMILY, ownerId: 'fam' },
  ],
  period: { from: '2025-12-01', to: '2026-11-04', today: '2026-11-04' },
};

export let setup: GetInvestmentsDashboardUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  spies.findAssetDetailsByOwners.mockResolvedValue([]);
  spies.findFixedIncomeByAssetIds.mockResolvedValue(new Map());
  quoteSpies.findHistories.mockResolvedValue([]);
  quoteSpies.findFxHistory.mockResolvedValue([]);
  quoteSpies.findFx.mockResolvedValue(undefined);
  quoteSpies.findQuotes.mockResolvedValue([]);
  incomeSpies.findPeriodIncomes.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetInvestmentsDashboardUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
      { provide: 'IQuoteRepository', useValue: quoteSpies },
      { provide: 'IIncomeRepository', useValue: incomeSpies },
    ],
  }).compile();

  setup = module.get(GetInvestmentsDashboardUseCase);
});
