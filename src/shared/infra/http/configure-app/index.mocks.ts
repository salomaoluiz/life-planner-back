import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

import { EnvService } from '@shared/infra/env/env.service';
import { buildCorsOptions } from '@shared/infra/http/cors';
import { setupSwagger } from '@shared/infra/http/swagger';

import { configureApp } from './index';

// region Mocks

jest.mock('@shared/infra/http/cors');
jest.mock('@shared/infra/http/swagger');

const envMock = { corsOrigins: 'https://example.com', swaggerEnabled: true };
const corsOptionsMock = { origin: ['https://example.com'] };
const appMock = {
  enableCors: jest.fn(),
  enableVersioning: jest.fn(),
  get: jest.fn((token: unknown) => (token === EnvService ? envMock : undefined)),
  setGlobalPrefix: jest.fn(),
  useBodyParser: jest.fn(),
} as unknown as NestExpressApplication;

// endregion Mocks

// region Spies

const buildCorsOptionsSpy = jest.mocked(buildCorsOptions);
const setupSwaggerSpy = jest.mocked(setupSwagger);

// endregion Spies

beforeEach(() => {
  jest.clearAllMocks();
  buildCorsOptionsSpy.mockReturnValue(corsOptionsMock as ReturnType<typeof buildCorsOptions>);
});

function setup() {
  configureApp(appMock);
}

const mocks = { app: appMock, corsOptions: corsOptionsMock, env: envMock, VersioningType };
const spies = { buildCorsOptions: buildCorsOptionsSpy, setupSwagger: setupSwaggerSpy };

export { mocks, setup, spies };
