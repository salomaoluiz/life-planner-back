import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

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

    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal Server Error';

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
      this.logger.log(LogLevel.WARN, `Http Error: ${JSON.stringify(message)}`, {
        module: 'AllExceptionsFilter',
      });
    }

    const responseBody = {
      message:
        typeof message === 'string'
          ? message
          : ((message as { message: string | undefined }).message ?? message),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
