import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { CreateFixedIncomeContributionUseCase } from './index';

export const spies = repositorySpies();

export let setup: CreateFixedIncomeContributionUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(CreateFixedIncomeContributionUseCase, spies);
});
