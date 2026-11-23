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
  EMBEDDINGS_API_KEY: 'your-embeddings-key',
  EMBEDDINGS_API_URL: 'https://embeddings.example.com/v1',
  EMBEDDINGS_DIMENSIONS: 1024,
  EMBEDDINGS_MODEL: 'your-embeddings-model',
  FINANCE_MATERIALIZATION_GATE_TTL_MS: 60000,
  FINNHUB_TOKEN: 'your-finnhub-token',
  GITHUB_TOKEN: 'your-token',
  INVESTMENT_INCOME_SERIES_JOB_ENABLED: true,
  INVESTMENT_QUOTE_REFRESH_COOLDOWN_MS: 60000,
  INVESTMENT_QUOTES_BRAPI_BATCH_SIZE: 20,
  INVESTMENT_QUOTES_JOB_ENABLED: true,
  INVESTMENT_QUOTES_MIN_INTERVAL_MS: 0,
  JWT_EXPIRES_IN: '1d',
  JWT_SECRET: 'secret',
  LLM_API_KEY: 'your-llm-key',
  LLM_API_URL: 'https://llm.example.com/v1',
  LLM_DAILY_LIGHT_LIMIT: 50,
  LLM_DAILY_SEARCH_LIMIT: 10,
  LLM_MODEL_LIGHT: 'your-light-model',
  LLM_MODEL_SEARCH: 'your-search-model',
  LLM_TIMEOUT_LIGHT_MS: 6000,
  LLM_TIMEOUT_SEARCH_MS: 15000,
  LLM_USAGE_TIMEZONE: 'America/Sao_Paulo',
  MARKET_INDEX_JOB_ENABLED: true,
  NODE_ENV: 'test',
  OPEN_FOOD_FACTS_TIMEOUT_MS: 2000,
  OPEN_FOOD_FACTS_URL: 'https://off.example.com',
  OPEN_FOOD_FACTS_USER_AGENT: 'LifePlanner/1.0',
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
