import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { EnvService } from './env.service';

// region Mocks

const envVarsMock = {
  APP_ENVIRONMENT: 'staging',
  CORS_ORIGINS: 'http://localhost:8081',
  DB_HOST: 'localhost',
  DB_NAME: 'test_db',
  DB_PASSWORD: 'password',
  DB_PORT: 5432,
  DB_USER: 'user',
  GITHUB_TOKEN: 'your-token',
  JWT_EXPIRES_IN: '1d',
  JWT_SECRET: 'secret',
  NODE_ENV: 'test',
  PORT: 3000,
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
