import { Test } from '@nestjs/testing';

import {
  quoteProviders,
  quoteSpies,
} from '@investment/application/service/QuoteContext/index.mocks';
import { incomeRepositorySpies } from '@investment/domain/entity/mocks/income.fixture';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetInvestmentsHomeSummaryUseCase } from './index';

export const spies = repositorySpies();
export const incomeSpies = incomeRepositorySpies();
export { quoteSpies };

export const mocks = {
  owners: [
    { owner: OwnerType.USER, ownerId: 'user-1' },
    { archived: true, owner: OwnerType.FAMILY, ownerId: 'fam-archived' },
    { owner: OwnerType.FAMILY, ownerId: 'fam' },
  ],
  today: '2026-11-04',
};

export let setup: GetInvestmentsHomeSummaryUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  incomeSpies.findReceivedByOwners.mockResolvedValue([]);
  incomeSpies.countPendingSuggestionsByAssets.mockResolvedValue(0);

  const module = await Test.createTestingModule({
    providers: [
      GetInvestmentsHomeSummaryUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
      { provide: 'IIncomeRepository', useValue: incomeSpies },
      ...quoteProviders,
    ],
  }).compile();

  setup = module.get(GetInvestmentsHomeSummaryUseCase);
});
