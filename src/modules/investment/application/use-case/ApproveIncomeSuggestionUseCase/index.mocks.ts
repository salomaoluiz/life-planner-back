import {
  buildIncomeUseCase,
  incomeScenario,
  wireIncomeSpies,
} from '@investment/domain/entity/mocks/incomeScenario.mocks';

import { ApproveIncomeSuggestionUseCase } from './index';

export const scenario = incomeScenario();

export let spies: ReturnType<typeof wireIncomeSpies>;
export let setup: ApproveIncomeSuggestionUseCase;

beforeEach(async () => {
  spies = wireIncomeSpies(scenario);
  setup = await buildIncomeUseCase(ApproveIncomeSuggestionUseCase, spies);
});
