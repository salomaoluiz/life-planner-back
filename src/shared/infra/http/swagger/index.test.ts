import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';

import { setupSwagger } from './index';

jest.mock('@nestjs/swagger', () => {
  const actual = jest.requireActual('@nestjs/swagger');
  return {
    ...actual,
    SwaggerModule: { createDocument: jest.fn(() => ({})), setup: jest.fn() },
  };
});

jest.mock('nestjs-zod', () => ({ cleanupOpenApiDoc: jest.fn((doc: unknown) => doc) }));

const app = {} as INestApplication;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GIVEN setupSwagger', () => {
  it('SHOULD NOT register the swagger route WHEN disabled', () => {
    setupSwagger(app, false);

    expect(SwaggerModule.setup).not.toHaveBeenCalled();
  });

  it('SHOULD register the swagger route at "swagger" WHEN enabled', () => {
    setupSwagger(app, true);

    expect(SwaggerModule.setup).toHaveBeenCalledTimes(1);
    expect(SwaggerModule.setup).toHaveBeenCalledWith(
      'swagger',
      app,
      expect.anything(),
      expect.objectContaining({ swaggerOptions: { persistAuthorization: true } }),
    );
  });
});
