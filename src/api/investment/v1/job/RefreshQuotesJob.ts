import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { RefreshTrackedQuotesUseCase } from '@investment/application/use-case/RefreshTrackedQuotesUseCase';
import { EnvService } from '@shared/infra/env/env.service';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { IScheduler } from '@shared/infra/scheduler/types';

const SAO_PAULO = 'America/Sao_Paulo';
const NEW_YORK = 'America/New_York';

interface Schedule {
  closeRun: boolean;
  cron: string;
  name: string;
  target: 'B3' | 'FX' | 'US';
  timeZone: string;
}

// Spec 104 FR 6, weekdays only: hourly at :05 during trading plus a close run after the market closes.
export const SCHEDULES: Schedule[] = [
  {
    closeRun: false,
    cron: '0 5 10-17 * * 1-5',
    name: 'quotes-b3-hourly',
    target: 'B3',
    timeZone: SAO_PAULO,
  },
  {
    closeRun: true,
    cron: '0 30 18 * * 1-5',
    name: 'quotes-b3-close',
    target: 'B3',
    timeZone: SAO_PAULO,
  },
  {
    closeRun: false,
    cron: '0 5 10-16 * * 1-5',
    name: 'quotes-us-hourly',
    target: 'US',
    timeZone: NEW_YORK,
  },
  {
    closeRun: true,
    cron: '0 45 16 * * 1-5',
    name: 'quotes-us-close',
    target: 'US',
    timeZone: NEW_YORK,
  },
  {
    closeRun: false,
    cron: '0 5 9-18 * * 1-5',
    name: 'quotes-fx-hourly',
    target: 'FX',
    timeZone: SAO_PAULO,
  },
  {
    closeRun: true,
    cron: '0 30 18 * * 1-5',
    name: 'quotes-fx-close',
    target: 'FX',
    timeZone: SAO_PAULO,
  },
];

// The only path that calls the quote APIs on its own. `INVESTMENT_QUOTES_JOB_ENABLED=false` turns it off.
@Injectable()
export class RefreshQuotesJob implements OnModuleInit {
  constructor(
    @Inject('IScheduler') private readonly scheduler: IScheduler,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly env: EnvService,
    private readonly refresh: RefreshTrackedQuotesUseCase,
  ) {}

  onModuleInit(): void {
    if (!this.env.investmentQuotesJobEnabled) {
      this.logger.log(LogLevel.INFO, 'Investment quotes job is disabled', {
        module: 'RefreshQuotesJob',
      });

      return;
    }

    for (const schedule of SCHEDULES) {
      this.scheduler.cron(schedule.name, schedule.cron, schedule.timeZone, async () => {
        await this.refresh.execute({ closeRun: schedule.closeRun, target: schedule.target });
      });
    }
  }
}
