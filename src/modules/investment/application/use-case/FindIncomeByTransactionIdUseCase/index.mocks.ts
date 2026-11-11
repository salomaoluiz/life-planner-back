import {
  buildIncomeUseCase,
  incomeScenario,
  wireIncomeSpies,
} from '@investment/domain/entity/mocks/incomeScenario.mocks';

import { FindIncomeByTransactionIdUseCase } from './index';

export const scenario = incomeScenario();

export let spies: ReturnType<typeof wireIncomeSpies>;
export let setup: FindIncomeByTransactionIdUseCase;

beforeEach(async () => {
  spies = wireIncomeSpies(scenario);
  setup = await buildIncomeUseCase(FindIncomeByTransactionIdUseCase, spies);
});
