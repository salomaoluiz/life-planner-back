import {
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { NotModifiedException } from '@shared/infra/http/not-modified';
import { LogLevel } from '@shared/infra/logger/types';
import { captureException } from '@shared/infra/monitoring';

import { mocks, setup } from './index.mocks';

jest.mock('@shared/infra/monitoring', () => ({ captureException: jest.fn() }));

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

describe('GIVEN a ValidationError', () => {
  beforeEach(() => {
    setup.catch(mocks.exceptions.validationError, mocks.argumentsHost);
  });

  it('SHOULD log WARN with details', () => {
    expect(mocks.logger.log).toHaveBeenCalledTimes(1);
    expect(mocks.logger.log).toHaveBeenCalledWith(LogLevel.WARN, 'Http Error: Validation Failed', {
      details: [
        {
          code: 'invalid_type',
          field: 'age',
          message: 'Expected number, received string',
        },
      ],
      module: 'AllExceptionsFilter',
    });
  });

  it('SHOULD reply with Bad Request (400)', () => {
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledTimes(1);
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      mocks.getResponse,
      {
        message: 'Validation Failed',
        path: '/test-url',
        statusCode: 400,
        timestamp: '2025-11-30T12:00:00.000Z',
      },
      HttpStatus.BAD_REQUEST,
    );
  });
});
describe('GIVEN an HttpException with status < 500', () => {
  beforeEach(() => {
    setup.catch(mocks.exceptions.badRequest, mocks.argumentsHost);
  });

  it('SHOULD log WARN', () => {
    expect(mocks.logger.log).toHaveBeenCalledTimes(1);
    expect(mocks.logger.log).toHaveBeenCalledWith(LogLevel.WARN, 'Http Error: Bad Request', {
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

describe('GIVEN an error on an invite URL', () => {
  const token = 'q3Jx0b9S2v1mA8kQ7rT4yU6pL5nW0zE3cF2hD1gB9aI';

  beforeEach(() => {
    mocks.httpAdapterHost.httpAdapter.getRequestUrl.mockReturnValueOnce(
      `/api/v1/family-invites/${token}/accept`,
    );
    setup.catch(mocks.exceptions.badRequest, mocks.argumentsHost);
  });

  it('SHOULD redact the token in the replied path', () => {
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      mocks.getResponse,
      expect.objectContaining({ path: '/api/v1/family-invites/:token/accept' }),
      HttpStatus.BAD_REQUEST,
    );
  });

  it('SHOULD never pass the token to the logger', () => {
    expect(JSON.stringify(mocks.logger.log.mock.calls)).not.toContain(token);
  });
});

describe('GIVEN a Conflict (409) that carries details', () => {
  it('SHOULD reply with the details next to the message', () => {
    setup.catch(mocks.exceptions.conflict, mocks.argumentsHost);

    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      mocks.getResponse,
      {
        blockers: { recurrences: [] },
        message: 'Category has pending items',
        path: '/test-url',
        statusCode: 409,
        timestamp: '2025-11-30T12:00:00.000Z',
      },
      409,
    );
  });

  it('SHOULD NOT spread the response body of other statuses', () => {
    setup.catch(mocks.exceptions.badRequest, mocks.argumentsHost);

    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenLastCalledWith(
      mocks.getResponse,
      expect.not.objectContaining({ blockers: expect.anything() }),
      400,
    );
  });
});

describe('GIVEN an Unprocessable Entity (422)', () => {
  it('SHOULD reply with the row errors of an import, and nothing else of the body', () => {
    setup.catch(mocks.exceptions.unprocessable, mocks.argumentsHost);

    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenLastCalledWith(
      mocks.getResponse,
      {
        errors: [{ code: 'INVALID_DATE', line: 3, message: 'Invalid date' }],
        message: 'The import has invalid rows',
        path: '/test-url',
        statusCode: 422,
        timestamp: '2025-11-30T12:00:00.000Z',
      },
      422,
    );
  });

  it('SHOULD reply with the details of a negative position (spec 102)', () => {
    setup.catch(mocks.exceptions.unprocessableDetails, mocks.argumentsHost);

    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenLastCalledWith(
      mocks.getResponse,
      {
        details: { date: '2026-09-15', operationId: 'op-1' },
        message: 'This change would make the position negative on 2026-09-15',
        path: '/test-url',
        statusCode: 422,
        timestamp: '2025-11-30T12:00:00.000Z',
      },
      422,
    );
  });

  it('SHOULD keep the plain shape WHEN there are no row errors', () => {
    setup.catch(mocks.exceptions.unprocessablePlain, mocks.argumentsHost);

    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenLastCalledWith(
      mocks.getResponse,
      {
        message: 'Account is archived',
        path: '/test-url',
        statusCode: 422,
        timestamp: '2025-11-30T12:00:00.000Z',
      },
      422,
    );
  });
});

describe('GIVEN a NotModifiedException (spec 092)', () => {
  beforeEach(() => {
    setup.catch(new NotModifiedException(), mocks.argumentsHost);
  });

  it('SHOULD reply with an empty 304 AND log nothing', () => {
    expect(mocks.logger.log).not.toHaveBeenCalled();
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      mocks.getResponse,
      undefined,
      HttpStatus.NOT_MODIFIED,
    );
  });
});

describe('GIVEN a coded error (spec 104)', () => {
  function replied(exception: HttpException) {
    setup.catch(exception, mocks.argumentsHost);

    return jest.mocked(mocks.httpAdapterHost.httpAdapter.reply).mock.lastCall?.[1];
  }

  it('SHOULD reply with the code of a 422', () => {
    expect(
      replied(new UnprocessableEntityException({ code: 'TICKER_NOT_FOUND', message: 'No asset' })),
    ).toMatchObject({ code: 'TICKER_NOT_FOUND', message: 'No asset', statusCode: 422 });
  });

  it('SHOULD reply with the code AND the wait of a 429', () => {
    expect(
      replied(
        new HttpException(
          { code: 'REFRESH_TOO_SOON', message: 'Too soon', retryAfterSeconds: 42 },
          429,
        ),
      ),
    ).toMatchObject({ code: 'REFRESH_TOO_SOON', retryAfterSeconds: 42, statusCode: 429 });
  });

  it('SHOULD reply with the code of a 503 AND nothing else of the body', () => {
    const body = replied(
      new ServiceUnavailableException({ code: 'QUOTE_SOURCE_UNAVAILABLE', extra: 'x' }),
    );

    expect(body).toMatchObject({ code: 'QUOTE_SOURCE_UNAVAILABLE', statusCode: 503 });
    expect(body).not.toHaveProperty('extra');
  });

  it('SHOULD keep the plain shape WHEN a 429 has a text body', () => {
    expect(replied(new HttpException('Slow down', 429))).not.toHaveProperty('code');
  });
});

describe('GIVEN the Sentry capture (spec 106)', () => {
  it('SHOULD capture a generic error AND an HttpException 500', () => {
    setup.catch(mocks.exceptions.generic, mocks.argumentsHost);
    setup.catch(mocks.exceptions.internalServerError, mocks.argumentsHost);

    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it.each(['badRequest', 'conflict', 'unprocessable', 'validationError'] as const)(
    'SHOULD NOT capture %s',
    (key) => {
      setup.catch(mocks.exceptions[key], mocks.argumentsHost);

      expect(captureException).not.toHaveBeenCalled();
    },
  );

  it('SHOULD NOT capture a NotModifiedException', () => {
    setup.catch(new NotModifiedException(), mocks.argumentsHost);

    expect(captureException).not.toHaveBeenCalled();
  });

  it('SHOULD capture an error raised outside a controller (no handler class) AND still reply', () => {
    const host = {
      getClass: () => null,
      switchToHttp: mocks.argumentsHost.switchToHttp,
    } as unknown as typeof mocks.argumentsHost;

    expect(() => setup.catch(mocks.exceptions.generic, host)).not.toThrow();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledTimes(1);
  });

  it('SHOULD still capture the exception WHEN the tags cannot be built', () => {
    const host = {
      getClass: () => {
        throw new Error('no class');
      },
      switchToHttp: mocks.argumentsHost.switchToHttp,
    } as unknown as typeof mocks.argumentsHost;

    setup.catch(mocks.exceptions.generic, host);

    expect(captureException).toHaveBeenCalledWith(mocks.exceptions.generic);
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledTimes(1);
  });

  it('SHOULD still reply WHEN the SDK throws', () => {
    jest.mocked(captureException).mockImplementation(() => {
      throw new Error('sdk down');
    });

    expect(() => setup.catch(mocks.exceptions.generic, mocks.argumentsHost)).not.toThrow();
    expect(mocks.httpAdapterHost.httpAdapter.reply).toHaveBeenCalledTimes(1);

    jest.mocked(captureException).mockReset();
  });
});
