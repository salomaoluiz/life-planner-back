import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { CreateFixedIncomeRateUseCase } from './index';

export const spies = repositorySpies();

export let setup: CreateFixedIncomeRateUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(CreateFixedIncomeRateUseCase, spies);
});
