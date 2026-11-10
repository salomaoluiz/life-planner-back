import { Test } from '@nestjs/testing';

import { quoteRepositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { HistoryBackfill } from './index';

export const spies = {
  brapi: { getDailyHistory: jest.fn() },
  logger: { log: jest.fn() },
  repository: quoteRepositorySpies(),
};

export let setup: HistoryBackfill;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      HistoryBackfill,
      { provide: 'IBrapiQuotes', useValue: spies.brapi },
      { provide: 'IQuoteRepository', useValue: spies.repository },
      { provide: 'ILogger', useValue: spies.logger },
    ],
  }).compile();

  setup = module.get(HistoryBackfill);
});
