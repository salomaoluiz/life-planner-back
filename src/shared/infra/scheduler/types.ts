export interface IScheduler {
  // Registers and starts a cron job; `handler` errors are caught and logged by the wrapper.
  cron(name: string, expression: string, timeZone: string, handler: () => Promise<void>): void;
}
