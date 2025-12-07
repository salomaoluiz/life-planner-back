import { HealthCheckResult, HealthCheckService, HttpHealthIndicator } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';

import { HealthController } from './health.controller';

// region Mocks

const healthCheckResultMock: HealthCheckResult = {
  details: { 'nestjs-docs': { status: 'up' } },
  error: {},
  info: { 'nestjs-docs': { status: 'up' } },
  status: 'ok',
};

const healthCheckServiceMock = {
  check: jest.fn().mockImplementation(async (indicators: (() => Promise<unknown>)[]) => {
    await Promise.all(indicators.map(async (indicator) => indicator()));
    return healthCheckResultMock;
  }),
} as unknown as HealthCheckService;

const httpHealthIndicatorMock = {
  pingCheck: jest.fn(),
} as unknown as HttpHealthIndicator;

// endregion Mocks

// region Spies

// endregion Spies

let setup: HealthController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      {
        provide: HealthCheckService,
        useValue: healthCheckServiceMock,
      },
      {
        provide: HttpHealthIndicator,
        useValue: httpHealthIndicatorMock,
      },
    ],
  }).compile();

  setup = module.get<HealthController>(HealthController);
});

const mocks = {
  healthCheckResult: healthCheckResultMock,
  healthCheckService: healthCheckServiceMock,
  httpHealthIndicator: httpHealthIndicatorMock,
};

const spies = {};

export { mocks, setup, spies };
