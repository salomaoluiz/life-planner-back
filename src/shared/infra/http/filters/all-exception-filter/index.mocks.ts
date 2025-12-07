import { ArgumentsHost, HttpException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { AllExceptionsFilter } from '@shared/infra/http/filters/all-exception-filter/index';

// region Mocks

const getResponseMock = {
  status: 500,
};

const switchToHttpMock = {
  getRequest: jest.fn(),
  getResponse: jest.fn().mockReturnValue(getResponseMock),
};

const argumentsHostMock = {
  switchToHttp: jest.fn().mockReturnValue(switchToHttpMock),
} as Partial<ArgumentsHost> as ArgumentsHost;

const httpAdapterHostMock = {
  httpAdapter: {
    getRequestUrl: jest.fn().mockReturnValue('/test-url'),
    reply: jest.fn(),
  },
};

const loggerMock = {
  log: jest.fn(),
};

const httpBadRequestMock = new HttpException('Bad Request', 400);
const httpInternalServerErrorMock = new HttpException('Internal Server Error', 500);
const validationErrorMock = new ValidationError([
  {
    code: 'invalid_type',
    field: 'age',
    message: 'Expected number, received string',
  },
]);
const genericExceptionMock = 'Generic Error';

// endregion Mocks

// region Spies

// endregion Spies

let setup: AllExceptionsFilter;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      AllExceptionsFilter,
      {
        provide: HttpAdapterHost,
        useValue: httpAdapterHostMock,
      },
      {
        provide: 'ILogger',
        useValue: loggerMock,
      },
    ],
  }).compile();

  setup = module.get<AllExceptionsFilter>(AllExceptionsFilter);
});

const mocks = {
  argumentsHost: argumentsHostMock,
  exceptions: {
    badRequest: httpBadRequestMock,
    generic: genericExceptionMock,
    internalServerError: httpInternalServerErrorMock,
    validationError: validationErrorMock,
  },
  getResponse: getResponseMock,
  httpAdapterHost: httpAdapterHostMock,
  logger: loggerMock,
};

export { mocks, setup };
