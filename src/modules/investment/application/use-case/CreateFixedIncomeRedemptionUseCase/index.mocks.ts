import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { CreateFixedIncomeRedemptionUseCase } from './index';

export const spies = repositorySpies();

export let setup: CreateFixedIncomeRedemptionUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(CreateFixedIncomeRedemptionUseCase, spies);
});
