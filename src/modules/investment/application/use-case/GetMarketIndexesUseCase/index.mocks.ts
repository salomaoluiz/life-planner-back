import { Test } from '@nestjs/testing';

import { marketIndexRepositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { GetMarketIndexesUseCase } from './index';

export const spies = marketIndexRepositorySpies();

export async function setup(): Promise<GetMarketIndexesUseCase> {
  const module = await Test.createTestingModule({
    providers: [GetMarketIndexesUseCase, { provide: 'IMarketIndexRepository', useValue: spies }],
  }).compile();

  return module.get(GetMarketIndexesUseCase);
}
