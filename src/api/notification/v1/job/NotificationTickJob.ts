import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { NotificationTickService } from '@api/notification/v1/notification-tick.service';
import { Database } from '@shared/infra/db/Database';
import { EnvService } from '@shared/infra/env/env.service';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { IScheduler } from '@shared/infra/scheduler/types';

export const NOTIFICATION_TICK_NAME = 'notification-tick';
// FR 26: one advisory lock for the whole tick, so two API instances never run it at the same time.
export const NOTIFICATION_LOCK_KEY = 124001;

// Spec 124 FR 26: `0 */N * * * *` (UTC) so ticks land on the same minutes every hour; N comes from
// `NOTIFICATION_TICK_MINUTES` (1, 5, 10, 15, 20, 30 or 60). `NOTIFICATION_JOB_ENABLED=false` turns it off.
export function tickCron(minutes: number): string {
  return minutes === 60 ? '0 0 * * * *' : `0 */${minutes} * * * *`;
}

@Injectable()
export class NotificationTickJob implements OnModuleInit {
  constructor(
    @Inject('IScheduler') private readonly scheduler: IScheduler,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly env: EnvService,
    private readonly database: Database,
    private readonly tick: NotificationTickService,
  ) {}

  onModuleInit(): void {
    if (!this.env.notificationJobEnabled) {
      this.logger.log(LogLevel.INFO, 'Notification tick job is disabled', {
        module: 'NotificationTickJob',
      });

      return;
    }

    this.scheduler.cron(
      NOTIFICATION_TICK_NAME,
      tickCron(this.env.notificationTickMinutes),
      'UTC',
      async () => {
        const ran = await this.database.withAdvisoryLock(NOTIFICATION_LOCK_KEY, async () =>
          this.tick.run(new Date()),
        );

        if (!ran) {
          this.logger.log(
            LogLevel.INFO,
            'Notification tick skipped: another instance holds the lock',
            {
              module: 'NotificationTickJob',
            },
          );
        }
      },
    );
  }
}
