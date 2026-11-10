import { Test } from '@nestjs/testing';

import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { HasInvestmentsByOwnerUseCase } from './index';

export const spies = repositorySpies();

export let setup: HasInvestmentsByOwnerUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      HasInvestmentsByOwnerUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
    ],
  }).compile();

  setup = module.get(HasInvestmentsByOwnerUseCase);
});
