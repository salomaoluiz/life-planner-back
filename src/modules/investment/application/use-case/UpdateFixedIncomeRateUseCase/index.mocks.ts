import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { UpdateFixedIncomeRateUseCase } from './index';

export const spies = repositorySpies();

export let setup: UpdateFixedIncomeRateUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(UpdateFixedIncomeRateUseCase, spies);
});
