import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { SimulateFixedIncomeUseCase } from './index';

export const spies = repositorySpies();

export let setup: SimulateFixedIncomeUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(SimulateFixedIncomeUseCase, spies);
});
