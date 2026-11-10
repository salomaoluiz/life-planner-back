import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { DeleteFixedIncomeRateUseCase } from './index';

export const spies = repositorySpies();

export let setup: DeleteFixedIncomeRateUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(DeleteFixedIncomeRateUseCase, spies);
});
