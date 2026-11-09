import { Test } from '@nestjs/testing';

import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { DeleteInvestmentsByOwnerUseCase } from './index';

export const spies = repositorySpies();

export let setup: DeleteInvestmentsByOwnerUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      DeleteInvestmentsByOwnerUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
    ],
  }).compile();

  setup = module.get(DeleteInvestmentsByOwnerUseCase);
});
