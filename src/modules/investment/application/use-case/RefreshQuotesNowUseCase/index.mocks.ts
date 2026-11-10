import { Test } from '@nestjs/testing';

import { QuoteFetcher } from '@investment/application/service/QuoteFetcher';
import {
  listRowFixture,
  quoteFixture,
  quoteRepositorySpies,
  repositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { EnvService } from '@shared/infra/env/env.service';

import { RefreshQuotesNowUseCase } from './index';

export const spies = {
  fetcher: { fetchFx: jest.fn(), fetchMarket: jest.fn() },
  investments: repositorySpies(),
  quotes: quoteRepositorySpies(),
};

export const mocks = {
  brStock: listRowFixture({ id: 'asset-br', ticker: 'ITSA4' }),
  owners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  quote: quoteFixture(),
  usStock: listRowFixture({
    assetClass: 'FOREIGN_STOCK' as never,
    currency: 'USD',
    id: 'asset-us',
    ticker: 'AAPL',
  }),
};

export let setup: RefreshQuotesNowUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      RefreshQuotesNowUseCase,
      { provide: 'IInvestmentRepository', useValue: spies.investments },
      { provide: 'IQuoteRepository', useValue: spies.quotes },
      { provide: QuoteFetcher, useValue: spies.fetcher },
      { provide: EnvService, useValue: { investmentQuoteRefreshCooldownMs: 60000 } },
    ],
  }).compile();

  setup = module.get(RefreshQuotesNowUseCase);
});
