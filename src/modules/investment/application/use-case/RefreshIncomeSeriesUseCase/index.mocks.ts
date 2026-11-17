import {
  buildSeriesUseCase,
  incomeSeriesScenario,
  wireSeriesSpies,
} from '@investment/domain/entity/mocks/incomeSeriesScenario.mocks';

import { RefreshIncomeSeriesUseCase } from './index';

export const scenario = incomeSeriesScenario();

export let spies: ReturnType<typeof wireSeriesSpies>;
export let setup: RefreshIncomeSeriesUseCase;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-11-12T15:00:00Z') });
  spies = wireSeriesSpies(scenario);
  setup = await buildSeriesUseCase(RefreshIncomeSeriesUseCase, spies);
});

afterEach(() => {
  jest.useRealTimers();
});
