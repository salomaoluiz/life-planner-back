import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { RefreshMarketIndexesUseCase } from '@investment/application/use-case/RefreshMarketIndexesUseCase';
import { EnvService } from '@shared/infra/env/env.service';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { IScheduler } from '@shared/infra/scheduler/types';

// Spec 113 FR 6, weekdays 19:00 São Paulo time: the CDI of D is published on the morning of D+1, the IPCA around
// the 10th of the month.
export const MARKET_INDEXES_SCHEDULE = {
  cron: '0 0 19 * * 1-5',
  name: 'market-indexes',
  timeZone: 'America/Sao_Paulo',
};

// `MARKET_INDEX_JOB_ENABLED=false` turns it off.
@Injectable()
export class RefreshMarketIndexesJob implements OnModuleInit {
  constructor(
    @Inject('IScheduler') private readonly scheduler: IScheduler,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly env: EnvService,
    private readonly refresh: RefreshMarketIndexesUseCase,
  ) {}

  onModuleInit(): void {
    if (!this.env.marketIndexJobEnabled) {
      this.logger.log(LogLevel.INFO, 'Market index job is disabled', {
        module: 'RefreshMarketIndexesJob',
      });

      return;
    }

    this.scheduler.cron(
      MARKET_INDEXES_SCHEDULE.name,
      MARKET_INDEXES_SCHEDULE.cron,
      MARKET_INDEXES_SCHEDULE.timeZone,
      async () => {
        await this.refresh.execute();
      },
    );
  }
}
