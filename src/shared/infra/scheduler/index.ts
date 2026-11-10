import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { ILogger, LogLevel } from '@shared/infra/logger/types';

import { IScheduler } from './types';

@Injectable()
export class Scheduler implements IScheduler, OnModuleDestroy {
  constructor(
    private readonly registry: SchedulerRegistry,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  cron(name: string, expression: string, timeZone: string, handler: () => Promise<void>): void {
    const job = CronJob.from({
      cronTime: expression,
      onTick: () => {
        handler().catch((error: unknown) => {
          this.logger.log(LogLevel.ERROR, `Scheduled job ${name} failed`, {
            error: error instanceof Error ? error.message : 'unknown',
            module: 'scheduler',
          });
        });
      },
      start: true,
      timeZone,
    });

    this.registry.addCronJob(name, job);
  }

  onModuleDestroy(): void {
    for (const job of this.registry.getCronJobs().values()) {
      void job.stop();
    }
  }
}
