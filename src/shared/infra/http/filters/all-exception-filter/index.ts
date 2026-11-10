import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { NotModifiedException } from '@shared/infra/http/not-modified';
import { redactSensitivePath } from '@shared/infra/http/redact-path';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { captureException } from '@shared/infra/monitoring';

import { buildCaptureContext, RequestLike } from './capture-context';

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

    // Spec 106: only unexpected errors reach Sentry; 4xx and 304 never do.
    if (httpStatus >= 500 || !(exception instanceof HttpException)) {
      this.report(exception, host, httpStatus);
    }

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

  // Monitoring must never break the reply or hide the original error: a failure while building the tags still sends
  // the exception (without them) and a failing SDK is ignored. `getClass()` is null outside a controller.
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

  private report(exception: unknown, host: ArgumentsHost, httpStatus: number): void {
    try {
      const request = host.switchToHttp().getRequest<RequestLike | undefined>() ?? {};
      const controller = (host as Partial<ExecutionContext>).getClass?.()?.name;

      captureException(exception, buildCaptureContext(request, httpStatus, controller));
    } catch {
      try {
        captureException(exception);
      } catch {
        // the SDK itself failed: nothing else to do
      }
    }
  }
}
