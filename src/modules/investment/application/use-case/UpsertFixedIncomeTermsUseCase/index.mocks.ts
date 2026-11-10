import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { UpsertFixedIncomeTermsUseCase } from './index';

export const spies = repositorySpies();

export let setup: UpsertFixedIncomeTermsUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(UpsertFixedIncomeTermsUseCase, spies);
});
