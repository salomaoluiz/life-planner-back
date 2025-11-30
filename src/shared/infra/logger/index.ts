import { Injectable, Scope } from '@nestjs/common';

import { PinoLogger } from './pino/PinoLogger';
import { ILogger, LogArgs, LogLevel } from './types';

@Injectable({ scope: Scope.DEFAULT })
export class Logger implements ILogger {
  private logger: ILogger;
  private pinoLogger = new PinoLogger();

  constructor() {
    /* You can add logic here to switch between different loggers in the future */
    this.logger = this.pinoLogger;
  }

  log(level: LogLevel, message: string, args: LogArgs) {
    this.logger.log(level, message, args);
  }
}
