import { Test } from '@nestjs/testing';

import { marketIndexRepositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { GetMarketIndexHistoryUseCase } from './index';

export const spies = marketIndexRepositorySpies();

export async function setup(): Promise<GetMarketIndexHistoryUseCase> {
  const module = await Test.createTestingModule({
    providers: [
      GetMarketIndexHistoryUseCase,
      { provide: 'IMarketIndexRepository', useValue: spies },
    ],
  }).compile();

  return module.get(GetMarketIndexHistoryUseCase);
}
