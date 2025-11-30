import { Logger, pino, stdTimeFunctions } from 'pino';

import { ILogger, LogArgs, LogLevel } from '@shared/infra/logger/types';

export class PinoLogger implements ILogger {
  private logger: Logger;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    this.logger = pino({
      level: isDevelopment ? 'debug' : 'info',
      timestamp: stdTimeFunctions.isoTime,
      transport: isDevelopment
        ? {
            options: {
              colorize: true,
              ignore: 'pid,hostname',
              messageFormat: '{msg}',
              singleLine: false,
              translateTime: 'SYS:standard',
            },
            target: 'pino-pretty',
          }
        : undefined,
    });
  }

  log(level: LogLevel, message: string, args: LogArgs) {
    this.logger.child(args)[level](message);
  }
}
