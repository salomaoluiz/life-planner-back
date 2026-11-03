import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

import { QueryCounter } from '@shared/infra/db/QueryCounter';
import { EnvService } from '@shared/infra/env/env.service';
import { buildCompression } from '@shared/infra/http/compression';
import { buildCorsOptions } from '@shared/infra/http/cors';
import { setupSwagger } from '@shared/infra/http/swagger';

import { configureApp } from './index';

// region Mocks

jest.mock('@shared/infra/http/compression');
jest.mock('@shared/infra/http/cors');
jest.mock('@shared/infra/http/swagger');
jest.mock('@shared/infra/db/QueryCounter');

const envMock = {
  corsOrigins: 'https://example.com',
  perfCountQueries: false,
  swaggerEnabled: true,
};
const corsOptionsMock = { origin: ['https://example.com'] };
const appMock = {
  enableCors: jest.fn(),
  enableVersioning: jest.fn(),
  get: jest.fn((token: unknown) => (token === EnvService ? envMock : undefined)),
  setGlobalPrefix: jest.fn(),
  use: jest.fn(),
  useBodyParser: jest.fn(),
} as unknown as NestExpressApplication;

// endregion Mocks

// region Spies

const compressionHandlerMock = jest.fn();
const buildCompressionSpy = jest.mocked(buildCompression);
const buildCorsOptionsSpy = jest.mocked(buildCorsOptions);
const setupSwaggerSpy = jest.mocked(setupSwagger);
const poolMaxWaitingSpy = jest.mocked(QueryCounter.poolMaxWaiting);
const resetPoolSpy = jest.mocked(QueryCounter.resetPool);

// endregion Spies

beforeEach(() => {
  jest.clearAllMocks();
  buildCompressionSpy.mockReturnValue(
    compressionHandlerMock as unknown as ReturnType<typeof buildCompression>,
  );
  buildCorsOptionsSpy.mockReturnValue(corsOptionsMock as ReturnType<typeof buildCorsOptions>);
});

function setup() {
  configureApp(appMock);
}

const mocks = {
  app: appMock,
  compressionHandler: compressionHandlerMock,
  corsOptions: corsOptionsMock,
  env: envMock,
  VersioningType,
};
const spies = {
  buildCompression: buildCompressionSpy,
  buildCorsOptions: buildCorsOptionsSpy,
  poolMaxWaiting: poolMaxWaitingSpy,
  resetPool: resetPoolSpy,
  setupSwagger: setupSwaggerSpy,
};

export { mocks, setup, spies };
