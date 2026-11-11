import {
  buildIncomeUseCase,
  incomeScenario,
  wireIncomeSpies,
} from '@investment/domain/entity/mocks/incomeScenario.mocks';

import { GetIncomeSuggestionsUseCase } from './index';

export const scenario = incomeScenario();

export let spies: ReturnType<typeof wireIncomeSpies>;
export let setup: GetIncomeSuggestionsUseCase;

beforeEach(async () => {
  spies = wireIncomeSpies(scenario);
  setup = await buildIncomeUseCase(GetIncomeSuggestionsUseCase, spies);
});
