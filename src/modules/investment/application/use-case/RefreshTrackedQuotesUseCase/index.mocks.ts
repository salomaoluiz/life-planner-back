import { Test } from '@nestjs/testing';

import { QuoteFetcher } from '@investment/application/service/QuoteFetcher';
import { quoteRepositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { RefreshTrackedQuotesUseCase } from './index';

export const spies = {
  fetcher: { fetchFx: jest.fn(), fetchMarket: jest.fn() },
  repository: quoteRepositorySpies(),
};

export let setup: RefreshTrackedQuotesUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  spies.repository.runExclusive.mockImplementation(
    async (_key: number, fn: () => Promise<void>) => {
      await fn();
      return true;
    },
  );

  const module = await Test.createTestingModule({
    providers: [
      RefreshTrackedQuotesUseCase,
      { provide: 'IQuoteRepository', useValue: spies.repository },
      { provide: QuoteFetcher, useValue: spies.fetcher },
    ],
  }).compile();

  setup = module.get(RefreshTrackedQuotesUseCase);
});
