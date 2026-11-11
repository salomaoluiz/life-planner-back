import {
  buildIncomeUseCase,
  incomeScenario,
  wireIncomeSpies,
} from '@investment/domain/entity/mocks/incomeScenario.mocks';

import { CreateIncomeUseCase } from './index';

export const scenario = incomeScenario();

export let spies: ReturnType<typeof wireIncomeSpies>;
export let setup: CreateIncomeUseCase;

beforeEach(async () => {
  spies = wireIncomeSpies(scenario);
  setup = await buildIncomeUseCase(CreateIncomeUseCase, spies);
});
