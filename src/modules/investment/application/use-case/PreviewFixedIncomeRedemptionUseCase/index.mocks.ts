import { buildUseCase } from '@investment/domain/entity/mocks/fixedIncomeUseCase.mocks';
import { repositorySpies } from '@investment/domain/entity/mocks/investment.fixture';

import { PreviewFixedIncomeRedemptionUseCase } from './index';

export const spies = repositorySpies();

export let setup: PreviewFixedIncomeRedemptionUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  setup = await buildUseCase(PreviewFixedIncomeRedemptionUseCase, spies);
});
