export enum LogLevel {
  DEBUG = 'debug',
  ERROR = 'error',
  FATAL = 'fatal',
  INFO = 'info',
  WARN = 'warn',
}

export interface ILogger {
  log(level: LogLevel, message: string, args: LogArgs): void;
}
export interface LogArgs {
  [key: string]: unknown;
  module: string;
}
