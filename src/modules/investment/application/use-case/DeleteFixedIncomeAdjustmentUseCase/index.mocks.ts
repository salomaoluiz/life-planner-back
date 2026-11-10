import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { DeleteFixedIncomeAdjustmentUseCase } from './index';

export const spies = repositorySpies();

export let setup: DeleteFixedIncomeAdjustmentUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(DeleteFixedIncomeAdjustmentUseCase, spies);
});
