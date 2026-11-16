import { Test } from '@nestjs/testing';

import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { incomeRepositorySpies } from '@investment/domain/entity/mocks/income.fixture';
import {
  quoteRepositorySpies,
  repositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetInvestmentsDashboardUseCase } from './index';

export const spies = repositorySpies();
export const incomeSpies = incomeRepositorySpies();
export const quoteRepoSpies = quoteRepositorySpies();
export const loadSpy = jest.fn();

export const mocks = {
  owners: [
    { owner: OwnerType.USER, ownerId: 'user-1' },
    { archived: true, owner: OwnerType.FAMILY, ownerId: 'fam-archived' },
    { owner: OwnerType.FAMILY, ownerId: 'fam' },
  ],
  today: '2026-11-04',
};

export let setup: GetInvestmentsDashboardUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  spies.findValuationsByAssets.mockResolvedValue(new Map());
  quoteRepoSpies.findHistoryBatch.mockResolvedValue([]);
  quoteRepoSpies.findFxOnOrBefore.mockResolvedValue(undefined);
  quoteRepoSpies.findFxHistory.mockResolvedValue([]);
  incomeSpies.findDashboardIncomes.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetInvestmentsDashboardUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
      { provide: 'IIncomeRepository', useValue: incomeSpies },
      { provide: 'IQuoteRepository', useValue: quoteRepoSpies },
      { provide: QuoteContextLoader, useValue: { load: loadSpy } },
    ],
  }).compile();

  setup = module.get(GetInvestmentsDashboardUseCase);
});
