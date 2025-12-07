import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { EnvService } from './env.service';

// region Mocks

const envVarsMock = {
  DB_HOST: 'localhost',
  DB_NAME: 'test_db',
  DB_PASSWORD: 'password',
  DB_PORT: 5432,
  DB_USER: 'user',
  JWT_EXPIRES_IN: '1d',
  JWT_SECRET: 'secret',
  NODE_ENV: 'test',
  PORT: 3000,
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
