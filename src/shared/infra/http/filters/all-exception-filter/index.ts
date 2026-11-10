import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { NotModifiedException } from '@shared/infra/http/not-modified';
import { redactSensitivePath } from '@shared/infra/http/redact-path';
import { ILogger, LogLevel } from '@shared/infra/logger/types';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,

    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof NotModifiedException) {
      httpAdapter.reply(ctx.getResponse(), undefined, httpStatus);

      return;
    }

    const message = this.getMessageFromException(exception);

    if (httpStatus >= 500) {
      this.logger.log(
        LogLevel.FATAL,
        `${exception instanceof Error ? exception.message : 'Unknown'}`,
        {
          module: 'AllExceptionsFilter',
          stack: exception instanceof Error ? exception.stack : undefined,
        },
      );
    } else {
      this.logger.log(LogLevel.WARN, `Http Error: ${message}`, {
        module: 'AllExceptionsFilter',
        ...(exception instanceof ValidationError && { details: exception.details }),
      });
    }

    const responseBody = {
      // A 409 may carry what blocks the action (counts, lists): the client needs them to explain it.
      ...this.getConflictDetails(exception, httpStatus),
      message,
      path: redactSensitivePath(httpAdapter.getRequestUrl(ctx.getRequest())),
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }

  private getConflictDetails(exception: unknown, httpStatus: number): Record<string, unknown> {
    if (
      (httpStatus !== HttpStatus.CONFLICT &&
        httpStatus !== HttpStatus.UNPROCESSABLE_ENTITY &&
        httpStatus !== HttpStatus.TOO_MANY_REQUESTS &&
        httpStatus !== HttpStatus.SERVICE_UNAVAILABLE) ||
      !(exception instanceof HttpException)
    ) {
      return {};
    }

    const response = exception.getResponse();

    if (typeof response !== 'object' || response === null) {
      return {};
    }

    // Spec 104: a machine-readable `code` (and the wait of a 429) travels with these statuses.
    if (
      httpStatus === HttpStatus.TOO_MANY_REQUESTS ||
      httpStatus === HttpStatus.SERVICE_UNAVAILABLE
    ) {
      const { code, retryAfterSeconds } = response as Record<string, unknown>;

      return {
        ...(code === undefined ? {} : { code }),
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      };
    }

    // A 422 only carries the per-row `errors` of an import (spec 047) and the `details` of a never-negative
    // position (spec 102: the date and operation where it breaks), nothing else.
    if (httpStatus === HttpStatus.UNPROCESSABLE_ENTITY) {
      const { code, details, errors } = response as Record<string, unknown>;

      return {
        ...(code === undefined ? {} : { code }),
        ...(errors === undefined ? {} : { errors }),
        ...(details === undefined ? {} : { details }),
      };
    }

    const details: Record<string, unknown> = { ...(response as Record<string, unknown>) };

    delete details.error;
    delete details.message;
    delete details.statusCode;

    return details;
  }

  private getMessageFromException(exception: unknown): string {
    switch (true) {
      case exception instanceof HttpException:
        return exception.message;
      default:
        return 'Internal Server Error';
    }
  }
}
