import {
  buildIncomeUseCase,
  incomeScenario,
  wireIncomeSpies,
} from '@investment/domain/entity/mocks/incomeScenario.mocks';

import { DeleteIncomeUseCase } from './index';

export const scenario = incomeScenario();

export let spies: ReturnType<typeof wireIncomeSpies>;
export let setup: DeleteIncomeUseCase;

beforeEach(async () => {
  spies = wireIncomeSpies(scenario);
  setup = await buildIncomeUseCase(DeleteIncomeUseCase, spies);
});
