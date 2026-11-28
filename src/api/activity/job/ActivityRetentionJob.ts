import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { CleanupActivityUseCase } from '@activity/application/use-case/CleanupActivityUseCase';
import { Database } from '@shared/infra/db/Database';
import { EnvService } from '@shared/infra/env/env.service';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { IScheduler } from '@shared/infra/scheduler/types';

export const ACTIVITY_RETENTION_NAME = 'activity-retention';
// One advisory lock, so two API instances never purge at the same time.
export const ACTIVITY_RETENTION_LOCK_KEY = 127001;
// Spec 127 FR 13: every day at 03:10 UTC.
export const ACTIVITY_RETENTION_CRON = '0 10 3 * * *';

@Injectable()
export class ActivityRetentionJob implements OnModuleInit {
  constructor(
    @Inject('IScheduler') private readonly scheduler: IScheduler,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly env: EnvService,
    private readonly database: Database,
    private readonly cleanupActivityUseCase: CleanupActivityUseCase,
  ) {}

  onModuleInit(): void {
    if (!this.env.activityRetentionJobEnabled) {
      this.logger.log(LogLevel.INFO, 'Activity retention job is disabled', {
        module: 'ActivityRetentionJob',
      });

      return;
    }

    this.scheduler.cron(ACTIVITY_RETENTION_NAME, ACTIVITY_RETENTION_CRON, 'UTC', async () => {
      const ran = await this.database.withAdvisoryLock(ACTIVITY_RETENTION_LOCK_KEY, async () => {
        const deleted = await this.cleanupActivityUseCase.execute({
          retentionDays: this.env.activityRetentionDays,
        });

        this.logger.log(LogLevel.INFO, 'Activity retention ran', {
          deleted,
          module: 'ActivityRetentionJob',
        });
      });

      if (!ran) {
        this.logger.log(
          LogLevel.INFO,
          'Activity retention skipped: another instance holds the lock',
          {
            module: 'ActivityRetentionJob',
          },
        );
      }
    });
  }
}
