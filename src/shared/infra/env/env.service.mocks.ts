import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { EnvService } from './env.service';

// region Mocks

const envVarsMock = {
  APP_ENVIRONMENT: 'staging',
  BRAPI_TOKEN: 'your-brapi-token',
  CORS_ORIGINS: 'http://localhost:8081',
  DB_HOST: 'localhost',
  DB_NAME: 'test_db',
  DB_PASSWORD: 'password',
  DB_POOL_CONNECTION_TIMEOUT_MS: 5000,
  DB_POOL_IDLE_TIMEOUT_MS: 30000,
  DB_POOL_MAX: 20,
  DB_PORT: 5432,
  DB_STATEMENT_TIMEOUT_MS: 10000,
  DB_USER: 'user',
  FINANCE_MATERIALIZATION_GATE_TTL_MS: 60000,
  FINNHUB_TOKEN: 'your-finnhub-token',
  GITHUB_TOKEN: 'your-token',
  INVESTMENT_QUOTE_REFRESH_COOLDOWN_MS: 60000,
  INVESTMENT_QUOTES_BRAPI_BATCH_SIZE: 20,
  INVESTMENT_QUOTES_JOB_ENABLED: true,
  INVESTMENT_QUOTES_MIN_INTERVAL_MS: 0,
  JWT_EXPIRES_IN: '1d',
  JWT_SECRET: 'secret',
  NODE_ENV: 'test',
  PERF_COUNT_QUERIES: false,
  PORT: 3000,
  SENTRY_DSN: undefined,
  SENTRY_ENABLED: false,
  SENTRY_ENVIRONMENT: undefined,
  SENTRY_TRACES_SAMPLE_RATE: 0,
  SESSION_IDLE_TTL_SECONDS: 172800,
  SWAGGER_ENABLED: true,
  VERSION_CHECK_TTL_SECONDS: 600,
  VERSION_REPO_API: 'your-org/your-api',
  VERSION_REPO_APP: 'your-org/your-app',
};

const nestConfigServiceMock = {
  get: jest.fn((key: keyof typeof envVarsMock) => envVarsMock[key]),
};

// endregion Mocks

// region Spies

const nestConfigServiceGetSpy = jest.mocked(nestConfigServiceMock.get);

// endregion Spies

beforeEach(() => {
  jest.clearAllMocks();
});

async function setup() {
  const module = await Test.createTestingModule({
    providers: [
      EnvService,
      {
        provide: ConfigService,
        useValue: nestConfigServiceMock,
      },
    ],
  }).compile();

  return module.get<EnvService>(EnvService);
}

const mocks = {
  envVars: envVarsMock,
  nestConfigService: nestConfigServiceMock,
};

const spies = {
  nestConfigServiceGet: nestConfigServiceGetSpy,
};

export { mocks, setup, spies };
