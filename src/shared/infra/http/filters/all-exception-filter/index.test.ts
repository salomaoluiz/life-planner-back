import { HttpStatus } from '@nestjs/common';

import { LogLevel } from '@shared/infra/logger/types';

import { mocks, setup } from './index.mocks';

jest.useFakeTimers({ now: new Date('2025-11-30T12:00:00Z') });

describe('GIVEN an Generic Error', () => {
  beforeEach(() => {
    setup.catch(mocks.exceptions.generic, mocks.argumentsHost);
  });

  it('SHOULD log FATAL', () => {
    expect(mocks.logger.log).toHaveBeenCalledTimes(1);
    expect(mocks.logger.log).toHaveBeenCalledWith(LogLevel.FATAL, 'Unknown', {
      module: 'AllExceptionsFilter',
      stack: undefined,
    });
  });

  it('SHOULD reply with Internal Server Error (500)', () => {
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledTimes(1);
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      mocks.getResponse,
      {
        message: 'Internal Server Error',
        path: '/test-url',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: '2025-11-30T12:00:00.000Z',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });
});

describe('GIVEN an HttpException with status < 500', () => {
  beforeEach(() => {
    setup.catch(mocks.exceptions.badRequest, mocks.argumentsHost);
  });

  it('SHOULD log WARN', () => {
    expect(mocks.logger.log).toHaveBeenCalledTimes(1);
    expect(mocks.logger.log).toHaveBeenCalledWith(LogLevel.WARN, 'Http Error: "Bad Request"', {
      module: 'AllExceptionsFilter',
    });
  });

  it('SHOULD reply with Bad Request (400)', () => {
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledTimes(1);
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      mocks.getResponse,
      {
        message: 'Bad Request',
        path: '/test-url',
        statusCode: HttpStatus.BAD_REQUEST,
        timestamp: '2025-11-30T12:00:00.000Z',
      },
      HttpStatus.BAD_REQUEST,
    );
  });
});

describe('GIVEN an HttpException with status >= 500', () => {
  beforeEach(() => {
    setup.catch(mocks.exceptions.internalServerError, mocks.argumentsHost);
  });

  it('SHOULD log FATAL', () => {
    expect(mocks.logger.log).toHaveBeenCalledTimes(1);
    expect(mocks.logger.log).toHaveBeenCalledWith(LogLevel.FATAL, 'Internal Server Error', {
      module: 'AllExceptionsFilter',
      stack: mocks.exceptions.internalServerError.stack,
    });
  });

  it('SHOULD reply with Internal Server Error (500)', () => {
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledTimes(1);
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      mocks.getResponse,
      {
        message: 'Internal Server Error',
        path: '/test-url',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: '2025-11-30T12:00:00.000Z',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });
});
