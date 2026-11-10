import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { CreateFixedIncomeTitleUseCase } from './index';

export const spies = repositorySpies();

export let setup: CreateFixedIncomeTitleUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(CreateFixedIncomeTitleUseCase, spies);
});
