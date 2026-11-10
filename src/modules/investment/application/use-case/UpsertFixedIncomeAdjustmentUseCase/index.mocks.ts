import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { UpsertFixedIncomeAdjustmentUseCase } from './index';

export const spies = repositorySpies();

export let setup: UpsertFixedIncomeAdjustmentUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(UpsertFixedIncomeAdjustmentUseCase, spies);
});
