import { Test } from '@nestjs/testing';

import {
  marketIndexRepositorySpies,
  quoteRepositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';

import { RefreshMarketIndexesUseCase } from './index';

export const spies = {
  bcb: { getIpcaExpectation: jest.fn(), getSeries: jest.fn() },
  indexes: marketIndexRepositorySpies(),
  logger: { log: jest.fn() },
  quotes: quoteRepositorySpies(),
};

export const mocks = {
  point: (date: string, value: string) => ({ date, value }),
};

export async function setup(): Promise<RefreshMarketIndexesUseCase> {
  const module = await Test.createTestingModule({
    providers: [
      RefreshMarketIndexesUseCase,
      { provide: 'IMarketIndexRepository', useValue: spies.indexes },
      { provide: 'IQuoteRepository', useValue: spies.quotes },
      { provide: 'IBcbIndexes', useValue: spies.bcb },
      { provide: 'ILogger', useValue: spies.logger },
    ],
  }).compile();

  return module.get(RefreshMarketIndexesUseCase);
}
