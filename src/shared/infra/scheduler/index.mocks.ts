import { SchedulerRegistry } from '@nestjs/schedule';

import { ILogger } from '@shared/infra/logger/types';

const stop = jest.fn();
const registry = {
  addCronJob: jest.fn(),
  getCronJobs: jest.fn(() => new Map([['job', { stop }]])),
} as unknown as SchedulerRegistry;
const logger: ILogger = { log: jest.fn() };

export { logger, registry, stop };
