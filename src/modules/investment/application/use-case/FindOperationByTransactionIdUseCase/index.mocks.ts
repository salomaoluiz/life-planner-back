import { Test } from '@nestjs/testing';

import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { FindOperationByTransactionIdUseCase } from './index';

export const spies = repositorySpies();

export let setup: FindOperationByTransactionIdUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      FindOperationByTransactionIdUseCase,
      { provide: 'IInvestmentRepository', useValue: spies },
    ],
  }).compile();

  setup = module.get(FindOperationByTransactionIdUseCase);
});
