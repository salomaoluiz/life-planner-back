import {
  buildSeriesUseCase,
  incomeSeriesScenario,
  wireSeriesSpies,
} from '@investment/domain/entity/mocks/incomeSeriesScenario.mocks';

import { GetIncomeSeriesProjectionsUseCase } from './index';

export const scenario = incomeSeriesScenario();

export let spies: ReturnType<typeof wireSeriesSpies>;
export let setup: GetIncomeSeriesProjectionsUseCase;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-11-12T15:00:00Z') });
  spies = wireSeriesSpies(scenario);
  setup = await buildSeriesUseCase(GetIncomeSeriesProjectionsUseCase, spies);
});

afterEach(() => {
  jest.useRealTimers();
});
